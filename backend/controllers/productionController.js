const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// ─── EXISTING MIXING MODULE CONTROLLERS (PRESERVED) ────────────────

// 1. Get Compounding/Mixing Jobs Queue
exports.getMixingQueue = (req, res) => {
  const sql = `
    SELECT 
      wo.*,
      i.item_code,
      i.item_name,
      i.unit,
      m.machine_name,
      m.machine_code,
      b.bom_id
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN machines m ON wo.machine_id = m.machine_id
    LEFT JOIN bom b ON wo.item_id = b.finished_item_id AND b.status = 'Active'
    WHERE wo.status IN ('Draft', 'Released', 'In Progress')
      AND m.machine_type = 'Mixing'
    ORDER BY wo.planned_start ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to retrieve mixing queue', error: err.message });
    }
    res.json(results);
  });
};

// 2. Get BOM Recipe & Current Stock for compound item
exports.getRecipe = (req, res) => {
  const { itemId } = req.params;
  const sql = `
    SELECT 
      bi.*,
      i.item_code as material_code,
      i.item_name as material_name,
      i.unit as material_unit,
      COALESCE(sp.current_qty, 0) as stock_qty
    FROM bom_items bi
    JOIN bom b ON bi.bom_id = b.bom_id
    JOIN items i ON bi.raw_material_id = i.item_id
    LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 1
    WHERE b.finished_item_id = ? AND b.status = 'Active'
  `;

  db.query(sql, [itemId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to retrieve recipe', error: err.message });
    }
    res.json(results);
  });
};

// 3. Complete Mixing/Compounding Batch
exports.completeMixingBatch = (req, res) => {
  const { wo_id, item_id, machine_id, batch_qty, ingredients, created_by } = req.body;

  if (!wo_id || !item_id || !machine_id || !batch_qty || !ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ message: 'Missing required compounding batch details.' });
  }

  // Count existing batches to format unique number: B/MIX/2026/00001
  db.query('SELECT COUNT(*) as count FROM batches', (err, countResult) => {
    if (err) {
      return res.status(500).json({ message: 'Database lookup error', error: err.message });
    }

    const nextCount = (countResult[0]?.count || 0) + 1;
    const year = new Date().getFullYear();
    const batchNumber = `B/MIX/${year}/${String(nextCount).padStart(5, '0')}`;

    // Start Transaction to ensure absolute database consistency
    db.beginTransaction(async (transactionErr) => {
      if (transactionErr) {
        return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });
      }

      try {
        // 1. Create Batch Entry (stage 1: Compounding, status: QC Hold)
        await new Promise((resolve, reject) => {
          db.query(
            `INSERT INTO batches (batch_number, wo_id, item_id, machine_id, quantity, current_stage_id, status, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, 1, 'QC Hold', ?, NOW())`,
            [batchNumber, wo_id, item_id, machine_id, batch_qty, created_by],
            (err2, insertRes) => {
              if (err2) return reject(err2);
              resolve(insertRes.insertId);
            }
          );
        });

        // 2. Fetch inserted batch_id
        const batchIdRes = await new Promise((resolve, reject) => {
          db.query('SELECT batch_id FROM batches WHERE batch_number = ?', [batchNumber], (err3, results) => {
            if (err3) return reject(err3);
            resolve(results[0]?.batch_id);
          });
        });

        // 3. Log Stage Entry in batch_movements
        await new Promise((resolve, reject) => {
          db.query(
            `INSERT INTO batch_movements (batch_id, stage_id, entered_at, moved_by, remarks)
             VALUES (?, 1, NOW(), ?, 'Compounding mixing complete. Sent for QC slab check.')`,
            [batchIdRes, created_by],
            (err4) => {
              if (err4) return reject(err4);
              resolve();
            }
          );
        });

        // 4. Update Work Order produced quantity & make it In Progress
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE work_orders 
             SET produced_qty = produced_qty + ?, status = 'In Progress', actual_start = COALESCE(actual_start, NOW()) 
             WHERE wo_id = ?`,
            [batch_qty, wo_id],
            (err5) => {
              if (err5) return reject(err5);
              resolve();
            }
          );
        });

        // 5. Deduct Raw Materials from Stock Positions & write Stock Ledger
        for (const ing of ingredients) {
          const deductionQty = parseFloat(ing.actual_qty || ing.target_qty || 0);
          if (deductionQty > 0) {
            await updateStock(
              db,
              ing.raw_material_id,
              1, // Store 1: Raw Material Store
              -deductionQty, // negative to deduct
              'Mixing Deduction',
              batchNumber,
              created_by
            );
          }
        }

        // Commit transaction
        db.commit((commitErr) => {
          if (commitErr) {
            return db.rollback(() => {
              res.status(500).json({ message: 'Transaction commit failed', error: commitErr.message });
            });
          }
          res.json({
            message: 'Compounding batch completed successfully!',
            batchNumber,
            batchId: batchIdRes,
            producedQty: batch_qty
          });
        });

      } catch (execErr) {
        db.rollback(() => {
          res.status(500).json({ message: 'Failed to record mixing completion', error: execErr.message });
        });
      }
    });
  });
};


// ─── NEW PRODUCTION / WORK ORDER MODULE CONTROLLERS ────────────────

// Helper: Auto-generate Work Order Number
const generateWorkOrderNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT wo_number FROM work_orders WHERE wo_number LIKE 'WO/%' ORDER BY wo_id DESC LIMIT 1",
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].wo_number;
          const parts = last.split('/');
          const lastSerial = parseInt(parts[parts.length - 1] || '0');
          nextNumber = lastSerial + 1;
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`WO/${year}/${serial}`);
      }
    );
  });
};

// Helper: Auto-generate MRN Number
const generateMRNNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT mrn_number FROM mrn WHERE mrn_number LIKE 'MRN/%' ORDER BY mrn_id DESC LIMIT 1",
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].mrn_number;
          const parts = last.split('/');
          const lastSerial = parseInt(parts[parts.length - 1] || '0');
          nextNumber = lastSerial + 1;
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`MRN/${year}/${serial}`);
      }
    );
  });
};
// Get all customers
exports.getCustomers = (req, res) => {
  db.query('SELECT * FROM customers', (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve customers', error: err.message });
    res.json(results);
  });
};

// 1. Get all Work Orders with filters
exports.getWorkOrders = (req, res) => {
  const { status, customer_id, product_id, search, start_date, end_date } = req.query;
  let sql = `
    SELECT 
      wo.wo_id,
      wo.wo_number,
      wo.item_id,
      wo.customer_id,
      wo.planned_qty,
      wo.planned_start,
      wo.planned_end,
      wo.actual_start,
      wo.actual_end,
      wo.machine_id,
      wo.status,
      wo.created_by,
      wo.created_at,
      wo.priority,
      wo.bom_id,
      wo.remarks,
      wo.pending_qty,
      i.item_name, 
      i.item_code, 
      c.customer_name,
      COALESCE(
        CASE 
          WHEN i.category = 'Finished Good' THEN (
            SELECT SUM(mpe.good_parts)
            FROM moulding_production_entries mpe
            JOIN moulding_job_cards jc ON mpe.jc_id = jc.jc_id
            WHERE jc.wo_id = wo.wo_id
          )
          ELSE (
            SELECT SUM(b.quantity)
            FROM batches b
            WHERE b.wo_id = wo.wo_id
          )
        END,
        0
      ) as produced_qty
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE 1=1
  `;
  const params = [];
  if (status && status !== 'All') {
    sql += ` AND wo.status = ?`;
    params.push(status);
  }
  if (customer_id && customer_id !== 'All') {
    sql += ` AND wo.customer_id = ?`;
    params.push(customer_id);
  }
  if (product_id && product_id !== 'All') {
    sql += ` AND wo.item_id = ?`;
    params.push(product_id);
  }
  if (search) {
    sql += ` AND (wo.wo_number LIKE ? OR i.item_name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (start_date) {
    sql += ` AND wo.planned_start >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND wo.planned_end <= ?`;
    params.push(end_date);
  }
  sql += ` ORDER BY wo.created_at DESC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error retrieving work orders', error: err.message });
    res.json(results);
  });
};

// 2. Create Work Order
exports.createWorkOrder = async (req, res) => {
  const { item_id, customer_id, planned_qty, planned_start, planned_end, priority, bom_id, remarks, releaseDirectly } = req.body;
  const created_by = req.user ? req.user.user_id : 1;

  if (!item_id || !customer_id || !planned_qty || !planned_start || !planned_end) {
    return res.status(400).json({ message: 'Missing required work order fields.' });
  }

  try {
    const wo_number = await generateWorkOrderNumber();
    const status = releaseDirectly ? 'Released' : 'Draft';
    const pending_qty = planned_qty;

    const sql = `
      INSERT INTO work_orders 
        (wo_number, item_id, customer_id, planned_qty, produced_qty, pending_qty, planned_start, planned_end, priority, bom_id, status, remarks, created_by, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(
      sql,
      [wo_number, item_id, customer_id, planned_qty, pending_qty, planned_start, planned_end, priority || 'Medium', bom_id || null, status, remarks || '', created_by],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to create work order', error: err.message });
        res.status(201).json({
          message: `Work Order ${wo_number} created successfully!`,
          wo_id: result.insertId,
          wo_number,
          status
        });
      }
    );
  } catch (err) {
    res.status(500).json({ message: 'Error generating work order number', error: err.message });
  }
};

// 3. Get single Work Order detail
exports.getWorkOrderById = (req, res) => {
  const { id } = req.params;
  
  const woSql = `
    SELECT 
      wo.wo_id,
      wo.wo_number,
      wo.item_id,
      wo.customer_id,
      wo.planned_qty,
      wo.planned_start,
      wo.planned_end,
      wo.actual_start,
      wo.actual_end,
      wo.machine_id,
      wo.status,
      wo.created_by,
      wo.created_at,
      wo.priority,
      wo.bom_id,
      wo.remarks,
      wo.pending_qty,
      i.item_name, 
      i.item_code, 
      c.customer_name, 
      b.version as bom_version,
      COALESCE(
        CASE 
          WHEN i.category = 'Finished Good' THEN (
            SELECT SUM(mpe.good_parts)
            FROM moulding_production_entries mpe
            JOIN moulding_job_cards jc ON mpe.jc_id = jc.jc_id
            WHERE jc.wo_id = wo.wo_id
          )
          ELSE (
            SELECT SUM(b.quantity)
            FROM batches b
            WHERE b.wo_id = wo.wo_id
          )
        END,
        0
      ) as produced_qty
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    LEFT JOIN bom b ON wo.bom_id = b.bom_id
    WHERE wo.wo_id = ?
  `;

  db.query(woSql, [id], (err, woResults) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    if (woResults.length === 0) return res.status(404).json({ message: 'Work Order not found.' });

    const wo = woResults[0];
    const bomId = wo.bom_id;

    // Fetch BOM stock availability and actual issued quantities
    const fetchBomCheck = () => {
      return new Promise((resolve) => {
        if (!bomId) return resolve([]);
        const bomItemsSql = `
          SELECT bi.*, i.item_name, i.item_code, i.unit as material_unit,
                 COALESCE(sp.current_qty, 0) as stock_qty,
                 COALESCE((
                   SELECT SUM(mi.issued_qty)
                   FROM mrn_items mi
                   JOIN mrn m ON mi.mrn_id = m.mrn_id
                   WHERE m.wo_id = ? AND mi.item_id = bi.raw_material_id
                 ), 0) as total_issued
          FROM bom_items bi
          JOIN items i ON bi.raw_material_id = i.item_id
          LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 1
          WHERE bi.bom_id = ?
        `;
        db.query(bomItemsSql, [id, bomId], (errB, bomItems) => {
          if (errB) {
            console.error('BOM check error:', errB);
            resolve([]);
          } else {
            const checkedItems = bomItems.map(item => {
              const reqQty = parseFloat(item.net_qty_per_unit || item.quantity || 0) * wo.planned_qty;
              const issuedQty = parseFloat(item.total_issued || 0);
              const pendingQty = Math.max(0, reqQty - issuedQty);
              return {
                ...item,
                required_qty: reqQty,
                issued_qty: issuedQty,
                pending_qty: pendingQty,
                available_stock: item.stock_qty,
                is_available: item.stock_qty >= pendingQty,
                item_status: issuedQty >= reqQty ? 'Issued' : (issuedQty > 0 ? 'Partial' : 'Pending')
              };
            });
            resolve(checkedItems);
          }
        });
      });
    };

    // Fetch linked MRNs with items list
    const fetchMRNs = () => {
      return new Promise((resolve) => {
        const mrnSql = `
          SELECT m.*, u.name as requested_by_name,
                 (
                   SELECT GROUP_CONCAT(i.item_name SEPARATOR ', ')
                   FROM mrn_items mi
                   JOIN items i ON mi.item_id = i.item_id
                   WHERE mi.mrn_id = m.mrn_id
                 ) as items_summary
          FROM mrn m
          LEFT JOIN users u ON m.requested_by = u.user_id
          WHERE m.wo_id = ?
        `;
        db.query(mrnSql, [id], (errM, mrns) => {
          if (errM) resolve([]);
          else resolve(mrns);
        });
      });
    };

    // Fetch moulding job cards with actual produced quantities
    const fetchJobCards = () => {
      return new Promise((resolve) => {
        const jcSql = `
          SELECT jc.*, m.machine_name, mo.mould_name,
                 COALESCE((
                   SELECT SUM(good_parts)
                   FROM moulding_production_entries
                   WHERE jc_id = jc.jc_id
                 ), 0) as produced_qty
          FROM moulding_job_cards jc
          LEFT JOIN machines m ON jc.machine_id = m.machine_id
          LEFT JOIN moulds mo ON jc.mould_id = mo.mould_id
          WHERE jc.wo_id = ?
        `;
        db.query(jcSql, [id], (errJ, jcs) => {
          if (errJ) resolve([]);
          else resolve(jcs);
        });
      });
    };

    // Fetch final quality control inspections for this work order
    const fetchFqcInspections = () => {
      return new Promise((resolve) => {
        const fqcSql = `
          SELECT fqc.*, u.name as inspector_name, qci.label_number
          FROM final_qc_inspections fqc
          JOIN users u ON fqc.inspected_by = u.user_id
          JOIN qc_inspections qci ON fqc.inspection_id = qci.inspection_id
          WHERE fqc.wo_id = ?
        `;
        db.query(fqcSql, [id], (errF, fqcList) => {
          if (errF) resolve([]);
          else resolve(fqcList);
        });
      });
    };

    Promise.all([fetchBomCheck(), fetchMRNs(), fetchJobCards(), fetchFqcInspections()]).then(([bomItems, mrns, jobCards, fqcInspections]) => {
      res.json({
        ...wo,
        bom_items: bomItems,
        mrns,
        job_cards: jobCards,
        fqc_inspections: fqcInspections
      });
    });
  });
};

// 4. Update Work Order
exports.updateWorkOrder = (req, res) => {
  const { id } = req.params;
  const { item_id, customer_id, planned_qty, planned_start, planned_end, priority, bom_id, remarks, status } = req.body;
  
  const sql = `
    UPDATE work_orders 
    SET item_id = ?, customer_id = ?, planned_qty = ?, pending_qty = (? - COALESCE(produced_qty, 0)),
        planned_start = ?, planned_end = ?, priority = ?, bom_id = ?, remarks = ?, status = COALESCE(?, status)
    WHERE wo_id = ?
  `;

  db.query(
    sql,
    [item_id, customer_id, planned_qty, planned_qty, planned_start, planned_end, priority, bom_id, remarks, status, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update work order', error: err.message });
      res.json({ message: 'Work Order updated successfully!' });
    }
  );
};

// 5. Release Work Order
exports.releaseWorkOrder = (req, res) => {
  const { id } = req.params;
  db.query("UPDATE work_orders SET status = 'Released' WHERE wo_id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to release work order', error: err.message });
    res.json({ message: 'Work Order released successfully!' });
  });
};

// 6. Cancel Work Order
exports.cancelWorkOrder = (req, res) => {
  const { id } = req.params;
  db.query("UPDATE work_orders SET status = 'Cancelled' WHERE wo_id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to cancel work order', error: err.message });
    res.json({ message: 'Work Order cancelled successfully!' });
  });
};

// 7. Get BOMs List
exports.getBOMs = (req, res) => {
  const sql = `
    SELECT b.*, i.item_name, i.item_code, u.name as creator_name,
           (SELECT COUNT(*) FROM bom_items WHERE bom_id = b.bom_id) as item_count
    FROM bom b
    JOIN items i ON b.finished_item_id = i.item_id
    LEFT JOIN users u ON b.created_by = u.user_id
    ORDER BY b.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve BOMs', error: err.message });
    res.json(results);
  });
};

// 8. Create BOM Version
exports.createBOM = (req, res) => {
  const { finished_item_id, version, effective_from, status, items } = req.body;
  const created_by = req.user ? req.user.user_id : 1;

  if (!finished_item_id || !version || !items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Missing required BOM header or item details.' });
  }

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    const deactivateSql = "UPDATE bom SET status = 'Inactive' WHERE finished_item_id = ? AND status = 'Active'";
    const runDeactivate = () => {
      return new Promise((resolve, reject) => {
        if (status === 'Active') {
          db.query(deactivateSql, [finished_item_id], (errD) => {
            if (errD) return reject(errD);
            resolve();
          });
        } else resolve();
      });
    };

    runDeactivate()
      .then(() => {
        db.query(
          `INSERT INTO bom (finished_item_id, version, status, effective_from, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [finished_item_id, version, status || 'Active', effective_from || null, created_by],
          (errB, bomRes) => {
            if (errB) return db.rollback(() => res.status(500).json({ message: 'Failed to insert BOM header', error: errB.message }));
            const bomId = bomRes.insertId;

            const insertItemSql = `
              INSERT INTO bom_items (bom_id, raw_material_id, quantity, unit, scrap_percent, net_qty_per_unit)
              VALUES (?, ?, ?, ?, ?, ?)
            `;

            let completed = 0;
            if (items.length === 0) {
              db.commit((commitErr) => {
                if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                return res.status(201).json({ message: 'BOM created successfully with no items.', bom_id: bomId });
              });
              return;
            }

            items.forEach(item => {
              const scrap = parseFloat(item.scrap_percent || 0);
              const qty = parseFloat(item.quantity || 0);
              const netQty = qty + (qty * scrap / 100);

              db.query(
                insertItemSql,
                [bomId, item.raw_material_id, qty, item.unit || 'gm', scrap, netQty],
                (errBi) => {
                  if (errBi) {
                    return db.rollback(() => res.status(500).json({ message: 'Failed to insert BOM item', error: errBi.message }));
                  }
                  completed++;
                  if (completed === items.length) {
                    db.commit((commitErr) => {
                      if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                      res.status(201).json({ message: 'BOM created successfully!', bom_id: bomId, version });
                    });
                  }
                }
              );
            });
          }
        );
      })
      .catch((errD) => {
        db.rollback(() => res.status(500).json({ message: 'Failed deactivating old BOMs', error: errD.message }));
      });
  });
};

// 9. Get BOM items & live stock levels by Item ID
exports.getBOMByItemId = (req, res) => {
  const { item_id } = req.params;
  const bomSql = "SELECT * FROM bom WHERE finished_item_id = ? AND status = 'Active' LIMIT 1";
  db.query(bomSql, [item_id], (err, bomRows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (bomRows.length === 0) return res.status(404).json({ message: 'No active BOM found for this product.' });

    const bom = bomRows[0];
    const itemsSql = `
      SELECT bi.*, i.item_name, i.item_code, i.unit as material_unit,
             COALESCE(sp.current_qty, 0) as stock_qty
      FROM bom_items bi
      JOIN items i ON bi.raw_material_id = i.item_id
      LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 1
      WHERE bi.bom_id = ?
    `;

    db.query(itemsSql, [bom.bom_id], (err2, items) => {
      if (err2) return res.status(500).json({ message: 'Failed to retrieve BOM items', error: err2.message });
      res.json({
        ...bom,
        items
      });
    });
  });
};

// 10. Update BOM (Generates new incremented version)
exports.updateBOM = (req, res) => {
  const { id } = req.params;
  const { version, effective_from, status, items } = req.body;
  const created_by = req.user ? req.user.user_id : 1;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Missing BOM items.' });
  }

  db.query('SELECT finished_item_id, version FROM bom WHERE bom_id = ?', [id], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ message: 'BOM not found' });

    const finished_item_id = rows[0].finished_item_id;
    let nextVersion = version;
    if (!nextVersion) {
      const currentVerNum = parseInt(rows[0].version.replace('v', '') || '1');
      nextVersion = `v${currentVerNum + 1}`;
    }

    req.body.finished_item_id = finished_item_id;
    req.body.version = nextVersion;
    req.body.status = status || 'Active';
    req.body.effective_from = effective_from || new Date().toISOString().slice(0, 10);
    
    exports.createBOM(req, res);
  });
};

// 11. Get Routing by Finished Item ID
exports.getRoutingByItemId = (req, res) => {
  const { item_id } = req.params;
  const sql = `
    SELECT rt.*, i.item_name, i.item_code
    FROM routing_templates rt
    JOIN items i ON rt.item_id = i.item_id
    WHERE rt.item_id = ?
    ORDER BY rt.stage_order ASC
  `;
  db.query(sql, [item_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve routing template', error: err.message });
    res.json(results);
  });
};

// 12. Create / Overwrite Routing Templates
exports.createRouting = (req, res) => {
  const { item_id, stages } = req.body;

  if (!item_id || !stages || !Array.isArray(stages)) {
    return res.status(400).json({ message: 'Missing product ID or stages list.' });
  }

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    db.query('DELETE FROM routing_templates WHERE item_id = ?', [item_id], (errD) => {
      if (errD) return db.rollback(() => res.status(500).json({ message: 'Failed to clear old routing templates', error: errD.message }));

      const sql = `
        INSERT INTO routing_templates (item_id, stage_name, stage_order, machine_type, standard_time_minutes, max_time_minutes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;

      let completed = 0;
      stages.forEach((s, idx) => {
        db.query(
          sql,
          [item_id, s.stage_name, s.stage_order || (idx + 1), s.machine_type || null, s.standard_time_minutes || null, s.max_time_minutes || null],
          (errI) => {
            if (errI) return db.rollback(() => res.status(500).json({ message: 'Failed to insert routing step', error: errI.message }));
            completed++;
            if (completed === stages.length) {
              db.commit((commitErr) => {
                if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                res.status(201).json({ message: 'Routing template saved successfully!' });
              });
            }
          }
        );
      });
    });
  });
};

// 13. Update Routing Template
exports.updateRouting = (req, res) => {
  const { id } = req.params;
  req.body.item_id = id;
  exports.createRouting(req, res);
};

// 14. Get all Material Requisition Notes (MRNs)
exports.getMRNs = (req, res) => {
  const { status, wo_id, start_date, end_date } = req.query;
  let sql = `
    SELECT m.*, wo.wo_number, i.item_name, i.item_code, u.name as requested_by_name,
           (SELECT COUNT(*) FROM mrn_items WHERE mrn_id = m.mrn_id) as item_count
    FROM mrn m
    JOIN work_orders wo ON m.wo_id = wo.wo_id
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN users u ON m.requested_by = u.user_id
    WHERE 1=1
  `;
  const params = [];
  if (status && status !== 'All') {
    sql += ' AND m.status = ?';
    params.push(status);
  }
  if (wo_id && wo_id !== 'All') {
    sql += ' AND m.wo_id = ?';
    params.push(wo_id);
  }
  if (start_date) {
    sql += ' AND m.request_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND m.request_date <= ?';
    params.push(end_date);
  }
  sql += ' ORDER BY m.created_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve MRNs', error: err.message });
    res.json(results);
  });
};

// 15. Create Material Requisition Note (Auto-filled from BOM)
exports.createMRN = async (req, res) => {
  const { wo_id, required_by_date, remarks } = req.body;
  const requested_by = req.user ? req.user.user_id : 1;

  if (!wo_id) {
    return res.status(400).json({ message: 'Work Order ID is required.' });
  }

  const woSql = 'SELECT planned_qty, item_id, bom_id FROM work_orders WHERE wo_id = ?';
  db.query(woSql, [wo_id], async (err, woRows) => {
    if (err || woRows.length === 0) return res.status(404).json({ message: 'Work order not found' });
    const wo = woRows[0];
    const bomId = wo.bom_id;

    if (!bomId) {
      return res.status(400).json({ message: 'Work Order does not have a BOM assigned. Please create a BOM first.' });
    }

    db.query('SELECT * FROM bom_items WHERE bom_id = ?', [bomId], async (err2, bomItems) => {
      if (err2) return res.status(500).json({ message: 'Error retrieving BOM items', error: err2.message });
      if (bomItems.length === 0) return res.status(400).json({ message: 'BOM does not contain raw materials.' });

      try {
        const mrn_number = await generateMRNNumber();

        db.beginTransaction((transactionErr) => {
          if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

          db.query(
            `INSERT INTO mrn (mrn_number, wo_id, requested_by, status, request_date, required_by_date, remarks, created_at)
             VALUES (?, ?, ?, 'Pending', NOW(), ?, ?, NOW())`,
            [mrn_number, wo_id, requested_by, required_by_date || null, remarks || ''],
            (errM, mrnRes) => {
              if (errM) return db.rollback(() => res.status(500).json({ message: 'Failed to insert MRN header', error: errM.message }));
              const mrnId = mrnRes.insertId;

              const insertItemSql = `
                INSERT INTO mrn_items (mrn_id, item_id, required_qty, issued_qty, unit)
                VALUES (?, ?, ?, 0.00, ?)
              `;

              let completed = 0;
              bomItems.forEach(item => {
                const reqQty = parseFloat(item.net_qty_per_unit || item.quantity || 0) * wo.planned_qty;
                db.query(
                  insertItemSql,
                  [mrnId, item.raw_material_id, reqQty, item.unit || 'kg'],
                  (errMi) => {
                    if (errMi) return db.rollback(() => res.status(500).json({ message: 'Failed to insert MRN item', error: errMi.message }));
                    completed++;
                    if (completed === bomItems.length) {
                      db.commit((commitErr) => {
                        if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                        res.status(201).json({
                          message: `Material Requisition ${mrn_number} created successfully!`,
                          mrn_id: mrnId,
                          mrn_number
                        });
                      });
                    }
                  }
                );
              });
            }
          );
        });
      } catch (errGen) {
        res.status(500).json({ message: 'Failed to generate MRN number', error: errGen.message });
      }
    });
  });
};

// 16. Get single MRN detail with live stock levels
exports.getMRNById = (req, res) => {
  const { id } = req.params;

  const mrnSql = `
    SELECT m.*, wo.wo_number, i.item_name as finished_product_name, i.item_code as finished_product_code, u.name as requested_by_name
    FROM mrn m
    JOIN work_orders wo ON m.wo_id = wo.wo_id
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN users u ON m.requested_by = u.user_id
    WHERE m.mrn_id = ?
  `;

  db.query(mrnSql, [id], (err, mrnRows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (mrnRows.length === 0) return res.status(404).json({ message: 'MRN not found.' });

    const mrn = mrnRows[0];

    const itemsSql = `
      SELECT mi.*, i.item_name, i.item_code,
             COALESCE(sp.current_qty, 0) as stock_qty
      FROM mrn_items mi
      JOIN items i ON mi.item_id = i.item_id
      LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 1
      WHERE mi.mrn_id = ?
    `;

    db.query(itemsSql, [id], (err2, items) => {
      if (err2) return res.status(500).json({ message: 'Failed to fetch MRN items', error: err2.message });
      res.json({
        ...mrn,
        items
      });
    });
  });
};

// 17. Issue MRN Item Material (Store Keeper View)
exports.issueMRNMaterial = (req, res) => {
  const { id } = req.params;
  const { barcode, mrn_item_id, quantity } = req.body;
  const issued_by = req.user ? req.user.user_id : 1;

  if (!mrn_item_id || !quantity) {
    return res.status(400).json({ message: 'mrn_item_id and quantity are required.' });
  }

  db.query('SELECT * FROM mrn_items WHERE mrn_item_id = ?', [mrn_item_id], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ message: 'MRN item not found' });
    const mrnItem = rows[0];

    let scannedItemCode = '';
    if (barcode) {
      const parts = barcode.trim().split('-');
      if (parts.length >= 2) scannedItemCode = parts[1];
    }

    db.query('SELECT item_code, item_name FROM items WHERE item_id = ?', [mrnItem.item_id], async (err2, itemRows) => {
      if (err2 || itemRows.length === 0) return res.status(500).json({ message: 'Failed to look up item' });
      const targetItem = itemRows[0];

      if (barcode && scannedItemCode !== targetItem.item_code) {
        return res.status(400).json({
          message: `Barcode mismatch! Scanned barcode is for item '${scannedItemCode}' but MRN requires '${targetItem.item_name} (${targetItem.item_code})'.`
        });
      }

      db.beginTransaction(async (transactionErr) => {
        if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

        try {
          const qtyToIssue = parseFloat(quantity);

          await updateStock(
            db,
            mrnItem.item_id,
            1,
            -qtyToIssue,
            'MRN Issue',
            barcode || `MRN-${id}`,
            issued_by
          );

          db.query(
            `UPDATE mrn_items 
             SET issued_qty = COALESCE(issued_qty, 0) + ?, 
                 issued_barcode = COALESCE(issued_barcode, ?),
                 issued_by = ?,
                 issued_at = NOW()
             WHERE mrn_item_id = ?`,
            [qtyToIssue, barcode || 'MANUAL', issued_by, mrn_item_id],
            (err3) => {
              if (err3) {
                return db.rollback(() => res.status(500).json({ message: 'Failed to update MRN item issued qty', error: err3.message }));
              }

              db.commit((commitErr) => {
                if (commitErr) {
                  return db.rollback(() => res.status(500).json({ message: 'Commit error', error: commitErr.message }));
                }

                db.query(`
                  SELECT 
                    SUM(required_qty) as total_required,
                    SUM(COALESCE(issued_qty, 0)) as total_issued
                  FROM mrn_items
                  WHERE mrn_id = ?
                `, [id], (errCheck, sumRows) => {
                  if (!errCheck && sumRows.length > 0) {
                    const req = parseFloat(sumRows[0].total_required);
                    const iss = parseFloat(sumRows[0].total_issued);
                    let newStatus = 'Partially Issued';
                    if (iss >= req) newStatus = 'Issued';
                    db.query('UPDATE mrn SET status = ? WHERE mrn_id = ?', [newStatus, id]);
                  }

                  res.json({
                    message: `Material ${targetItem.item_name} successfully issued!`,
                    mrn_item_id,
                    issued_qty: qtyToIssue
                  });
                });
              });
            }
          );
        } catch (execErr) {
          db.rollback(() => {
            res.status(500).json({ message: 'Failed to issue material', error: execErr.message });
          });
        }
      });
    });
  });
};

// 17b. Issue MRN Materials Batch (Store Keeper View)
exports.issueMRNMaterialBatch = (req, res) => {
  const { id } = req.params;
  const { issues } = req.body;
  const issued_by = req.user ? req.user.user_id : 1;

  if (!issues || !Array.isArray(issues) || issues.length === 0) {
    return res.status(400).json({ message: 'Issues list is required.' });
  }

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    try {
      for (const iss of issues) {
        const { mrn_item_id, item_id, quantity, barcode } = iss;
        const qtyToIssue = parseFloat(quantity);
        if (qtyToIssue > 0) {
          // Deduct from Store stock
          await updateStock(
            db,
            item_id,
            1,
            -qtyToIssue,
            'MRN Issue',
            barcode || `MRN-${id}`,
            issued_by
          );

          // Update MRN item
          await new Promise((resolve, reject) => {
            db.query(
              `UPDATE mrn_items 
               SET issued_qty = COALESCE(issued_qty, 0) + ?, 
                   issued_barcode = COALESCE(issued_barcode, ?),
                   issued_by = ?,
                   issued_at = NOW()
               WHERE mrn_item_id = ?`,
              [qtyToIssue, barcode || 'MANUAL', issued_by, mrn_item_id],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      }

      db.commit((commitErr) => {
        if (commitErr) {
          return db.rollback(() => res.status(500).json({ message: 'Commit error', error: commitErr.message }));
        }

        db.query(`
          SELECT 
            SUM(required_qty) as total_required,
            SUM(COALESCE(issued_qty, 0)) as total_issued
          FROM mrn_items
          WHERE mrn_id = ?
        `, [id], (errCheck, sumRows) => {
          if (!errCheck && sumRows.length > 0) {
            const reqVal = parseFloat(sumRows[0].total_required);
            const issVal = parseFloat(sumRows[0].total_issued);
            let newStatus = 'Partially Issued';
            if (issVal >= reqVal) newStatus = 'Issued';
            db.query('UPDATE mrn SET status = ? WHERE mrn_id = ?', [newStatus, id]);
          }

          res.json({ message: 'Materials issued successfully!' });
        });
      });
    } catch (err) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to issue materials batch', error: err.message });
      });
    }
  });
};

// 18. Close MRN
exports.closeMRN = (req, res) => {
  const { id } = req.params;
  db.query("UPDATE mrn SET status = 'Issued' WHERE mrn_id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to close MRN', error: err.message });
    res.json({ message: 'MRN closed and marked as Issued successfully!' });
  });
};

// 19. Shop Floor Live View Dashboard Query
exports.getShopFloorView = (req, res) => {
  const activeWoSql = `
    SELECT wo.*, i.item_name, i.item_code, c.customer_name
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE wo.status IN ('Released', 'In Progress')
    ORDER BY wo.priority DESC, wo.planned_end ASC
  `;

  const machinesSql = `
    SELECT m.machine_id, m.machine_name, m.machine_code, m.status as machine_status,
           jc.jc_number, jc.planned_qty,
           i.item_name as running_product,
           (SELECT SUM(good_parts) FROM moulding_production_entries WHERE jc_id = jc.jc_id) as good_parts_count
    FROM machines m
    LEFT JOIN moulding_job_cards jc ON m.machine_id = jc.machine_id AND jc.status = 'In Progress'
    LEFT JOIN items i ON jc.item_id = i.item_id
    WHERE m.machine_type = 'Molding'
  `;

  const summarySql = `
    SELECT 
      COALESCE(SUM(good_parts), 0) as total_produced,
      COALESCE(SUM(rejected_parts), 0) as total_rejected,
      (SELECT COUNT(*) FROM work_orders WHERE status = 'Completed' AND actual_end >= CURDATE()) as completed_today,
      (SELECT COUNT(*) FROM work_orders WHERE status = 'In Progress') as in_progress_count
    FROM moulding_production_entries
    WHERE entry_date >= CURDATE()
  `;

  db.query(activeWoSql, (err, activeWOs) => {
    if (err) return res.status(500).json({ message: 'Error retrieving active WOs', error: err.message });

    db.query(machinesSql, (err2, machinesList) => {
      if (err2) return res.status(500).json({ message: 'Error retrieving machine statuses', error: err2.message });

      db.query(summarySql, (err3, summaryRows) => {
        if (err3) return res.status(500).json({ message: 'Error retrieving production summary', error: err3.message });

        const stats = summaryRows[0] || { total_produced: 0, total_rejected: 0, completed_today: 0, in_progress_count: 0 };
        const totalProduced = parseFloat(stats.total_produced);
        const totalRejected = parseFloat(stats.total_rejected);
        const totalPieces = totalProduced + totalRejected;
        const rejectPercent = totalPieces > 0 ? ((totalRejected / totalPieces) * 100).toFixed(1) : '0.0';

        res.json({
          active_work_orders: activeWOs,
          machines: machinesList,
          summary: {
            total_produced: totalProduced,
            total_rejected: totalRejected,
            reject_percent: rejectPercent,
            completed_today: stats.completed_today,
            in_progress_count: stats.in_progress_count
          }
        });
      });
    });
  });
};
