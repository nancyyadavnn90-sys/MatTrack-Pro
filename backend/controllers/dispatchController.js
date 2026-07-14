const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// Helper: Auto-generate DO Number (DO/YYYY/NNNNN)
const generateDONumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT do_number FROM dispatch_orders ORDER BY do_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].do_number;
          const parts = last.split('/');
          const lastSerial = parseInt(parts[2] || '0');
          if (!isNaN(lastSerial)) {
            nextNumber = lastSerial + 1;
          }
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`DO/${year}/${serial}`);
      }
    );
  });
};

// Helper: Auto-generate Gate Pass Number (GP/YYYY/NNNNN)
const generateGPNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT gp_number FROM gate_passes ORDER BY gp_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].gp_number;
          const parts = last.split('/');
          const lastSerial = parseInt(parts[2] || '0');
          if (!isNaN(lastSerial)) {
            nextNumber = lastSerial + 1;
          }
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`GP/${year}/${serial}`);
      }
    );
  });
};

// 1. Get all Dispatch Orders list
exports.getDispatchOrders = (req, res) => {
  const sql = `
    SELECT 
      do.*,
      c.customer_name,
      COALESCE((SELECT SUM(qty) FROM dispatch_items WHERE do_id = do.do_id), 0) as total_pieces,
      (SELECT COUNT(*) FROM dispatch_items WHERE do_id = do.do_id) as item_lines,
      (SELECT gp_number FROM gate_passes WHERE dc_number = do.do_number LIMIT 1) as outward_gp_number,
      (SELECT gp_id FROM gate_passes WHERE dc_number = do.do_number LIMIT 1) as outward_gp_id
    FROM dispatch_orders do
    JOIN customers c ON do.customer_id = c.customer_id
    ORDER BY do.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error retrieving dispatch orders', error: err.message });
    res.json(results);
  });
};

// 2. Get Dispatch stats
exports.getDispatchStats = (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total_dispatches,
      SUM(CASE WHEN status IN ('Draft', 'PDI Pending', 'PDI Failed') THEN 1 ELSE 0 END) as pending_pdi,
      SUM(CASE WHEN status = 'Ready to Dispatch' THEN 1 ELSE 0 END) as ready_to_dispatch,
      SUM(CASE WHEN status = 'Dispatched' AND DATE(dispatch_date) = CURDATE() THEN 1 ELSE 0 END) as dispatched_today
    FROM dispatch_orders
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching stats', error: err.message });
    res.json(results[0] || { total_dispatches: 0, pending_pdi: 0, ready_to_dispatch: 0, dispatched_today: 0 });
  });
};

// 3. Get customers helper
exports.getCustomers = (req, res) => {
  db.query('SELECT customer_id, customer_name FROM customers ORDER BY customer_name ASC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching customers', error: err.message });
    res.json(results);
  });
};

// 4. Get Finished Goods items helper (with stock quantities)
exports.getFGItems = (req, res) => {
  const sql = `
    SELECT 
      i.item_id,
      i.item_code,
      i.item_name,
      i.unit,
      COALESCE(SUM(sp.current_qty), 0) as available_stock
    FROM items i
    LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 3
    WHERE i.category = 'Finished Good'
    GROUP BY i.item_id
    ORDER BY i.item_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching FG items', error: err.message });
    res.json(results);
  });
};

// 5. Look up box sticker / FQC barcode detail
exports.lookupBarcode = (req, res) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(450).json({ message: 'Barcode is required' });

  // Query database to identify item details from FQC or FGR
  const sql = `
    SELECT 
      qci.inspection_number,
      qci.label_number,
      fgr.fgr_number,
      COALESCE(fgr.received_qty, qci.accepted_qty) as accepted_qty,
      qci.item_id,
      i.item_code,
      i.item_name,
      i.unit,
      wo.wo_id,
      wo.wo_number,
      c.customer_name,
      c.customer_id
    FROM qc_inspections qci
    JOIN items i ON qci.item_id = i.item_id
    JOIN final_qc_inspections fqc ON qci.inspection_id = fqc.inspection_id
    JOIN work_orders wo ON fqc.wo_id = wo.wo_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    LEFT JOIN fg_receipts fgr ON qci.fgr_id = fgr.fgr_id
    WHERE qci.label_number = ? OR qci.inspection_number = ? OR fgr.fgr_number = ?
  `;

  db.query(sql, [barcode, barcode, barcode], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error looking up barcode', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'FG Label / FQC record not found' });
    res.json(results[0]);
  });
};

// 6. Create Dispatch Order (with transaction)
exports.createDispatchOrder = (req, res) => {
  const {
    customer_id,
    dispatch_date,
    vehicle_number,
    driver_name,
    transporter,
    pdi_status, // 'Passed' or 'Failed'
    status, // 'Draft' or 'Dispatched'
    remarks,
    items // array of { item_id, wo_id, qty, unit }
  } = req.body;

  const created_by = req.user.user_id;

  if (!customer_id || !dispatch_date || !items || items.length === 0) {
    return res.status(400).json({ message: 'Customer, dispatch date, and items are required' });
  }

  // Business logic: if status is 'Dispatched', PDI must be Passed
  if (status === 'Dispatched' && pdi_status !== 'Passed') {
    return res.status(400).json({ message: 'Loading authorized only if PDI (Pre-Dispatch Inspection) Status is Passed!' });
  }

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) {
      return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });
    }

    try {
      // 1. Generate DO number
      const do_number = await generateDONumber();

      // 2. Insert dispatch order header
      const insertHeaderSql = `
        INSERT INTO dispatch_orders 
          (do_number, customer_id, dispatch_date, vehicle_number, driver_name, transporter, status, created_by, created_at, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `;

      // Wait, dispatch_orders might not have remarks column. Let's check schema:
      // do_id, do_number, customer_id, dispatch_date, vehicle_number, driver_name, transporter, status, created_by, created_at.
      // Ah! No remarks column in database for dispatch_orders header. Let's omit remarks or check if we should add it.
      // We will insert without remarks.
      const insertHeaderSqlNoRemarks = `
        INSERT INTO dispatch_orders 
          (do_number, customer_id, dispatch_date, vehicle_number, driver_name, transporter, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      const do_id = await new Promise((resolve, reject) => {
        db.query(
          insertHeaderSqlNoRemarks,
          [do_number, customer_id, dispatch_date, vehicle_number, driver_name, transporter, status, created_by],
          (err, insertRes) => {
            if (err) return reject(err);
            resolve(insertRes.insertId);
          }
        );
      });

      // 3. Insert items, deduct stock & write stock ledger if Dispatched
      for (const item of items) {
        const insertItemSql = `
          INSERT INTO dispatch_items (do_id, item_id, wo_id, qty, unit, fgr_number)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await new Promise((resolve, reject) => {
          db.query(
            insertItemSql,
            [do_id, item.item_id, item.wo_id || null, item.qty, item.unit || 'Nos', item.fgr_number || null],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });

        if (status === 'Dispatched') {
          // Deduct stock (Store 3: Finished Goods Store). Qty is negative for outward dispatch
          await updateStock(db, item.item_id, 3, -parseFloat(item.qty), 'Dispatch', do_number, created_by);
        }
      }

      // 4. Auto-generate Outward Gate Pass if status is 'Dispatched'
      if (status === 'Dispatched') {
        const gp_number = await generateGPNumber();
        
        const insertGPSql = `
          INSERT INTO gate_passes 
            (gp_number, gp_type, customer_id, vehicle_number, driver_name, dc_number, remarks, created_by, created_at)
          VALUES (?, 'Outward', ?, ?, ?, ?, ?, ?, NOW())
        `;

        const gp_remarks = `Auto-generated outward gate pass for dispatch order ${do_number}`;

        const gp_id = await new Promise((resolve, reject) => {
          db.query(
            insertGPSql,
            [gp_number, customer_id, vehicle_number, driver_name, do_number, gp_remarks, created_by],
            (err, gpRes) => {
              if (err) return reject(err);
              resolve(gpRes.insertId);
            }
          );
        });

        // Insert items into gate_pass_items
        for (const item of items) {
          const insertGPItemSql = `
            INSERT INTO gate_pass_items (gp_id, item_id, expected_qty, unit)
            VALUES (?, ?, ?, ?)
          `;
          await new Promise((resolve, reject) => {
            db.query(
              insertGPItemSql,
              [gp_id, item.item_id, item.qty, item.unit || 'Nos'],
              (err) => {
                if (err) return reject(err);
                resolve();
              }
            );
          });
        }
      }

      db.commit((commitErr) => {
        if (commitErr) {
          return db.rollback(() => {
            res.status(500).json({ message: 'Commit error', error: commitErr.message });
          });
        }
        res.status(201).json({
          message: 'Dispatch Order created successfully',
          do_number,
          do_id
        });
      });

    } catch (innerErr) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to complete dispatch order', error: innerErr.message });
      });
    }
  });
};

// 7. Get single Dispatch Order details by ID
exports.getDispatchOrderById = (req, res) => {
  const { id } = req.params;

  const headerSql = `
    SELECT 
      do.*,
      c.customer_name,
      gp.gp_number as outward_gp_number,
      gp.gp_id as outward_gp_id,
      gp.status as gate_pass_status,
      u.name as creator_name
    FROM dispatch_orders do
    JOIN customers c ON do.customer_id = c.customer_id
    LEFT JOIN gate_passes gp ON gp.dc_number = do.do_number
    LEFT JOIN users u ON do.created_by = u.user_id
    WHERE do.do_id = ?
  `;

  db.query(headerSql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Dispatch Order not found' });

    const order = results[0];

    const itemsSql = `
      SELECT 
        di.*,
        i.item_code,
        i.item_name,
        wo.wo_number
      FROM dispatch_items di
      JOIN items i ON di.item_id = i.item_id
      LEFT JOIN work_orders wo ON di.wo_id = wo.wo_id
      WHERE di.do_id = ?
    `;

    db.query(itemsSql, [id], (err2, items) => {
      if (err2) return res.status(500).json({ message: 'Database error fetching items', error: err2.message });
      res.json({ ...order, items });
    });
  });
};

// 8. Update Dispatch Order (Draft -> Dispatched / Edit Draft)
exports.updateDispatchOrder = (req, res) => {
  const { id } = req.params;
  const {
    customer_id,
    dispatch_date,
    vehicle_number,
    driver_name,
    transporter,
    pdi_status,
    status,
    items
  } = req.body;

  const created_by = req.user.user_id;

  if (!customer_id || !dispatch_date || !items || items.length === 0) {
    return res.status(400).json({ message: 'Customer, date, and items are required' });
  }

  if (status === 'Dispatched' && pdi_status !== 'Passed') {
    return res.status(400).json({ message: 'Loading authorized only if PDI (Pre-Dispatch Inspection) Status is Passed!' });
  }

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) {
      return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });
    }

    try {
      // 1. Get original order to verify status and do_number
      const originalOrder = await new Promise((resolve, reject) => {
        db.query('SELECT do_number, status FROM dispatch_orders WHERE do_id = ?', [id], (err, results) => {
          if (err) return reject(err);
          if (results.length === 0) return reject(new Error('Dispatch Order not found'));
          resolve(results[0]);
        });
      });

      if (originalOrder.status === 'Dispatched') {
        return reject(new Error('Cannot modify an already Dispatched order.'));
      }

      const do_number = originalOrder.do_number;

      // 2. Update header
      const updateHeaderSql = `
        UPDATE dispatch_orders 
        SET customer_id = ?, dispatch_date = ?, vehicle_number = ?, driver_name = ?, transporter = ?, status = ?
        WHERE do_id = ?
      `;

      await new Promise((resolve, reject) => {
        db.query(
          updateHeaderSql,
          [customer_id, dispatch_date, vehicle_number, driver_name, transporter, status, id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // 3. Delete existing items
      await new Promise((resolve, reject) => {
        db.query('DELETE FROM dispatch_items WHERE do_id = ?', [id], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // 4. Insert new items, deduct stock & write stock ledger if Dispatched
      for (const item of items) {
        const insertItemSql = `
          INSERT INTO dispatch_items (do_id, item_id, wo_id, qty, unit, fgr_number)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await new Promise((resolve, reject) => {
          db.query(
            insertItemSql,
            [id, item.item_id, item.wo_id || null, item.qty, item.unit || 'Nos', item.fgr_number || null],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });

        if (status === 'Dispatched') {
          // Deduct stock (Store 3: Finished Goods Store). Qty is negative for outward dispatch
          await updateStock(db, item.item_id, 3, -parseFloat(item.qty), 'Dispatch', do_number, created_by);
        }
      }

      // 5. Auto-generate Outward Gate Pass if status changed to 'Dispatched'
      if (status === 'Dispatched') {
        const gp_number = await generateGPNumber();
        
        const insertGPSql = `
          INSERT INTO gate_passes 
            (gp_number, gp_type, customer_id, vehicle_number, driver_name, dc_number, remarks, created_by, created_at)
          VALUES (?, 'Outward', ?, ?, ?, ?, ?, ?, NOW())
        `;

        const gp_remarks = `Auto-generated outward gate pass for dispatch order ${do_number}`;

        const gp_id = await new Promise((resolve, reject) => {
          db.query(
            insertGPSql,
            [gp_number, customer_id, vehicle_number, driver_name, do_number, gp_remarks, created_by],
            (err, gpRes) => {
              if (err) return reject(err);
              resolve(gpRes.insertId);
            }
          );
        });

        // Insert items into gate_pass_items
        for (const item of items) {
          const insertGPItemSql = `
            INSERT INTO gate_pass_items (gp_id, item_id, expected_qty, unit)
            VALUES (?, ?, ?, ?)
          `;
          await new Promise((resolve, reject) => {
            db.query(
              insertGPItemSql,
              [gp_id, item.item_id, item.qty, item.unit || 'Nos'],
              (err) => {
                if (err) return reject(err);
                resolve();
              }
            );
          });
        }
      }

      db.commit((commitErr) => {
        if (commitErr) {
          return db.rollback(() => {
            res.status(500).json({ message: 'Commit error', error: commitErr.message });
          });
        }
        res.json({
          message: 'Dispatch Order updated successfully',
          do_number
        });
      });

    } catch (innerErr) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to update dispatch order', error: innerErr.message });
      });
    }
  });
};

// 9. Get Finished Goods stock by customer ID
exports.getCustomerFGStock = (req, res) => {
  const { customer_id } = req.params;
  const sql = `
    SELECT 
      i.item_id,
      i.item_code,
      i.item_name,
      i.unit,
      wo.wo_number,
      wo.wo_id,
      fgr.fgr_number,
      -- Available stock is FGR received quantity minus any quantities already dispatched from this FGR batch!
      (fgr.received_qty - COALESCE((
        SELECT SUM(di.qty) 
        FROM dispatch_items di
        JOIN dispatch_orders dord ON di.do_id = dord.do_id
        WHERE di.fgr_number = fgr.fgr_number
      ), 0)) as available_stock
    FROM fg_receipts fgr
    JOIN work_orders wo ON fgr.wo_id = wo.wo_id
    JOIN items i ON fgr.item_id = i.item_id
    WHERE wo.customer_id = ?
    HAVING available_stock > 0
    ORDER BY fgr.created_at ASC
  `;

  db.query(sql, [customer_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error retrieving customer FG stock', error: err.message });
    res.json(results);
  });
};

// 10. Submit Pre-Dispatch Inspection (PDI) results
exports.submitPDI = (req, res) => {
  const { id } = req.params;
  const {
    pdi_date,
    inspector_name,
    result, // 'Passed' or 'Failed'
    remarks
  } = req.body;

  if (!result || !inspector_name) {
    return res.status(400).json({ message: 'Inspector name and PDI result are required' });
  }

  const nextStatus = result === 'Passed' ? 'Ready to Dispatch' : 'PDI Failed';

  const updateSql = `
    UPDATE dispatch_orders 
    SET pdi_status = ?, pdi_date = ?, pdi_inspector = ?, status = ?, remarks = ?
    WHERE do_id = ?
  `;

  db.query(
    updateSql,
    [result, pdi_date || new Date().toISOString().split('T')[0], inspector_name, nextStatus, remarks || `PDI Result: ${result}`, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error updating PDI result', error: err.message });
      res.json({ message: `PDI results submitted successfully. Order status updated to ${nextStatus}.` });
    }
  );
};

// 11. Scan box barcode and register it as Loaded
exports.scanLoadItem = (req, res) => {
  const { id } = req.params;
  const { barcode } = req.body;

  if (!barcode) return res.status(400).json({ message: 'Barcode is required' });

  const lookupSql = `
    SELECT 
      qci.item_id,
      i.item_code,
      i.item_name,
      i.unit,
      COALESCE(fgr.received_qty, qci.accepted_qty) as scanned_qty
    FROM qc_inspections qci
    JOIN items i ON qci.item_id = i.item_id
    JOIN final_qc_inspections fqc ON qci.inspection_id = fqc.inspection_id
    LEFT JOIN fg_receipts fgr ON qci.fgr_id = fgr.fgr_id
    WHERE qci.label_number = ? OR qci.inspection_number = ? OR fgr.fgr_number = ? OR fqc.fqc_number = ?
    LIMIT 1
  `;

  db.query(lookupSql, [barcode, barcode, barcode, barcode], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error looking up barcode', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Barcode label not found in system' });

    const scannedItem = results[0];

    db.query('SELECT * FROM dispatch_items WHERE do_id = ? AND item_id = ?', [id, scannedItem.item_id], (err2, itemResults) => {
      if (err2) return res.status(500).json({ message: 'Database error', error: err2.message });
      if (itemResults.length === 0) {
        return res.status(400).json({ message: `Scanned item "${scannedItem.item_name}" is not part of this dispatch order!` });
      }

      const dispatchItem = itemResults[0];

      if (dispatchItem.loaded_qty >= dispatchItem.qty) {
        return res.status(400).json({ message: `Item "${scannedItem.item_name}" is already fully loaded (${dispatchItem.loaded_qty}/${dispatchItem.qty}).` });
      }

      const additionalLoaded = parseFloat(scannedItem.scanned_qty || 1);
      const newLoadedQty = Math.min(dispatchItem.qty, dispatchItem.loaded_qty + additionalLoaded);

      db.query(
        'UPDATE dispatch_items SET loaded_qty = ? WHERE dispatch_item_id = ?',
        [newLoadedQty, dispatchItem.dispatch_item_id],
        (errUpdate) => {
          if (errUpdate) return res.status(500).json({ message: 'Failed to update loaded quantity', error: errUpdate.message });
          
          res.json({
            message: `Successfully loaded ${additionalLoaded} pieces of "${scannedItem.item_name}".`,
            item_id: scannedItem.item_id,
            loaded_qty: newLoadedQty,
            qty: dispatchItem.qty
          });
        }
      );
    });
  });
};

// 12. Close shipment (Direct Dispatch)
exports.closeShipment = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });

    try {
      const dOrder = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM dispatch_orders WHERE do_id = ?', [id], (err, results) => {
          if (err) return reject(err);
          if (results.length === 0) return reject(new Error('Dispatch order not found'));
          resolve(results[0]);
        });
      });

      if (dOrder.status === 'Dispatched') {
        return res.status(400).json({ message: 'Shipment is already closed' });
      }

      const dItems = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM dispatch_items WHERE do_id = ?', [id], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      await new Promise((resolve, reject) => {
        db.query("UPDATE dispatch_orders SET status = 'Dispatched' WHERE do_id = ?", [id], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      const gp_number = await generateGPNumber();
      const insertGPSql = `
        INSERT INTO gate_passes 
          (gp_number, gp_type, customer_id, vehicle_number, driver_name, dc_number, status, remarks, created_by, created_at)
        VALUES (?, 'Outward', ?, ?, ?, ?, 'Closed', ?, ?, NOW())
      `;
      const gp_remarks = `Auto-generated outward gate pass for dispatch order ${dOrder.do_number}`;

      const gp_id = await new Promise((resolve, reject) => {
        db.query(
          insertGPSql,
          [gp_number, dOrder.customer_id, dOrder.vehicle_number, dOrder.driver_name, dOrder.do_number, gp_remarks, user_id],
          (err, gpRes) => {
            if (err) return reject(err);
            resolve(gpRes.insertId);
          }
        );
      });

      for (const item of dItems) {
        const insertGPItemSql = `
          INSERT INTO gate_pass_items (gp_id, item_id, expected_qty, unit)
          VALUES (?, ?, ?, ?)
        `;
        await new Promise((resolve, reject) => {
          db.query(
            insertGPItemSql,
            [gp_id, item.item_id, item.qty, item.unit || 'Nos'],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });

        await updateStock(db, item.item_id, 3, -parseFloat(item.qty), 'Dispatch', dOrder.do_number, user_id);
      }

      db.commit((commitErr) => {
        if (commitErr) {
          return db.rollback(() => res.status(500).json({ message: 'Commit error', error: commitErr.message }));
        }
        res.json({
          message: 'Shipment closed successfully. Outward Gate Pass created and FG stock updated.',
          do_number: dOrder.do_number,
          gp_number
        });
      });

    } catch (innerErr) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to close shipment', error: innerErr.message });
      });
    }
  });
};

// 13. Mark Dispatch Order as Delivered
exports.markDelivered = (req, res) => {
  const { id } = req.params;
  
  db.query(
    "UPDATE dispatch_orders SET status = 'Delivered' WHERE do_id = ?",
    [id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to mark as delivered', error: err.message });
      res.json({ message: 'Dispatch Order status updated to Delivered' });
    }
  );
};


