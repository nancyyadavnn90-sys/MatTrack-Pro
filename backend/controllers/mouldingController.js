const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// Helper: Auto-generate Job Card Number: JC/2026/00001
const generateJobCardNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT jc_number FROM moulding_job_cards ORDER BY jc_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].jc_number;
          const lastSerial = parseInt(last.split('/')[2] || '0');
          nextNumber = lastSerial + 1;
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`JC/${year}/${serial}`);
      }
    );
  });
};

// ─── PART 1: MOULD MASTER (TOOL MASTER) ───────────────────────────────────

exports.getMoulds = (req, res) => {
  const sql = `
    SELECT m.*, i.item_code, i.item_name 
    FROM moulds m
    JOIN items i ON m.item_id = i.item_id
    ORDER BY m.mould_code ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve moulds', error: err.message });
    res.json(results);
  });
};

exports.getMouldById = (req, res) => {
  const { id } = req.params;
  const mouldSql = `
    SELECT m.*, i.item_name, i.item_code 
    FROM moulds m 
    JOIN items i ON m.item_id = i.item_id 
    WHERE m.mould_id = ?
  `;
  
  db.query(mouldSql, [id], (err, mouldRows) => {
    if (err) return res.status(500).json({ message: 'Failed to load mould details', error: err.message });
    if (mouldRows.length === 0) return res.status(404).json({ message: 'Mould not found' });

    const logSql = `SELECT * FROM mould_maintenance_log WHERE mould_id = ? ORDER BY maintenance_date DESC`;
    db.query(logSql, [id], (err2, logs) => {
      if (err2) return res.status(500).json({ message: 'Failed to load maintenance logs', error: err2.message });
      
      const mappingSql = `SELECT machine_id FROM mould_machine_mapping WHERE mould_id = ?`;
      db.query(mappingSql, [id], (err3, mappings) => {
        if (err3) return res.status(500).json({ message: 'Failed to load machine mappings', error: err3.message });
        res.json({
          mould: mouldRows[0],
          maintenanceHistory: logs,
          compatibleMachines: mappings.map(m => m.machine_id)
        });
      });
    });
  });
};

exports.createMould = (req, res) => {
  const {
    mould_code, mould_name, item_id, mould_type, cavities,
    total_shots_allowed, mould_material, platen_length,
    platen_width, platen_height, weight_kg, maintenance_due_shots,
    compatible_machines
  } = req.body;

  if (!mould_code || !mould_name || !item_id || !mould_type || !cavities) {
    return res.status(400).json({ message: 'Missing required mould parameters.' });
  }

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    const sql = `
      INSERT INTO moulds (mould_code, mould_name, item_id, mould_type, cavities, total_shots_allowed, mould_material, platen_length, platen_width, platen_height, weight_kg, maintenance_due_shots, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available')
    `;

    db.query(
      sql,
      [mould_code, mould_name, item_id, mould_type, cavities, total_shots_allowed || 500000, mould_material, platen_length || 450, platen_width || 450, platen_height || 150, weight_kg || 0, maintenance_due_shots || 480000],
      (err, result) => {
        if (err) {
          return db.rollback(() => res.status(500).json({ message: 'Failed to create mould', error: err.message }));
        }

        const mouldId = result.insertId;

        if (compatible_machines && compatible_machines.length > 0) {
          const mappingValues = compatible_machines.map(macId => [mouldId, macId]);
          const mappingSql = `INSERT INTO mould_machine_mapping (mould_id, machine_id) VALUES ?`;
          db.query(mappingSql, [mappingValues], (mappingErr) => {
            if (mappingErr) {
              return db.rollback(() => res.status(500).json({ message: 'Failed to save mould machine mappings', error: mappingErr.message }));
            }
            db.commit((commitErr) => {
              if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
              res.status(210).json({ message: 'Mould registered successfully with machine bounds!', mouldId });
            });
          });
        } else {
          db.commit((commitErr) => {
            if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
            res.status(210).json({ message: 'Mould registered successfully!', mouldId });
          });
        }
      }
    );
  });
};

exports.updateMould = (req, res) => {
  const { id } = req.params;
  const { mould_name, cavities, total_shots_allowed, mould_material, platen_length, platen_width, platen_height, weight_kg, maintenance_due_shots, status } = req.body;

  const sql = `
    UPDATE moulds 
    SET mould_name = ?, cavities = ?, total_shots_allowed = ?, mould_material = ?, platen_length = ?, platen_width = ?, platen_height = ?, weight_kg = ?, maintenance_due_shots = ?, status = ?
    WHERE mould_id = ?
  `;

  db.query(
    sql,
    [mould_name, cavities, total_shots_allowed, mould_material, platen_length, platen_width, platen_height, weight_kg, maintenance_due_shots, status, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update mould', error: err.message });
      res.json({ message: 'Mould details updated.' });
    }
  );
};

exports.logMouldMaintenance = (req, res) => {
  const { id } = req.params;
  const { maintenance_type, done_by, remarks, next_due_shots } = req.body;

  if (!maintenance_type || !done_by) {
    return res.status(400).json({ message: 'Missing maintenance type or operator name.' });
  }

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    db.query('SELECT shots_used FROM moulds WHERE mould_id = ?', [id], (err, rows) => {
      if (err || rows.length === 0) {
        return db.rollback(() => res.status(404).json({ message: 'Mould not found', error: err?.message }));
      }
      const currentShots = rows[0].shots_used;

      const logSql = `
        INSERT INTO mould_maintenance_log (mould_id, maintenance_type, shots_at_maintenance, done_by, remarks, next_due_shots)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.query(logSql, [id, maintenance_type, currentShots, done_by, remarks, next_due_shots || (currentShots + 480000)], (err2) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Failed to insert maintenance log', error: err2.message }));
        }

        const updateMouldSql = `
          UPDATE moulds 
          SET shots_used = 0, status = 'Available', last_maintenance_date = NOW(), maintenance_due_shots = ?
          WHERE mould_id = ?
        `;
        db.query(updateMouldSql, [next_due_shots || 480000, id], (err3) => {
          if (err3) {
            return db.rollback(() => res.status(500).json({ message: 'Failed to update mould status', error: err3.message }));
          }

          db.commit((commitErr) => {
            if (commitErr) {
              return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
            }
            res.json({ message: 'Mould maintenance completed successfully and shots reset!' });
          });
        });
      });
    });
  });
};


// ─── PART 2: JOB CARDS ────────────────────────────────────────────────────

exports.getJobCards = (req, res) => {
  const sql = `
    SELECT jc.*, mld.cavities, wo.wo_number, i.item_name, i.item_code, mld.mould_code, mld.mould_name, mac.machine_name, mac.machine_code, fb.fb_number, c.customer_name
    FROM moulding_job_cards jc
    JOIN work_orders wo ON jc.wo_id = wo.wo_id
    JOIN items i ON jc.item_id = i.item_id
    JOIN moulds mld ON jc.mould_id = mld.mould_id
    JOIN machines mac ON jc.machine_id = mac.machine_id
    JOIN final_batches fb ON jc.fb_id = fb.fb_id
    LEFT JOIN customers c ON jc.customer_id = c.customer_id
    ORDER BY jc.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to load job cards', error: err.message });
    res.json(results);
  });
};

exports.getJobCardById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT jc.*, mld.cavities, wo.wo_number, i.item_name, i.item_code, mld.mould_code, mld.mould_name, mac.machine_name, mac.machine_code, fb.fb_number, c.customer_name
    FROM moulding_job_cards jc
    JOIN work_orders wo ON jc.wo_id = wo.wo_id
    JOIN items i ON jc.item_id = i.item_id
    JOIN moulds mld ON jc.mould_id = mld.mould_id
    JOIN machines mac ON jc.machine_id = mac.machine_id
    JOIN final_batches fb ON jc.fb_id = fb.fb_id
    LEFT JOIN customers c ON jc.customer_id = c.customer_id
    WHERE jc.jc_id = ?
  `;
  
  db.query(sql, [id], (err, jcRows) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve job card details', error: err.message });
    if (jcRows.length === 0) return res.status(404).json({ message: 'Job Card not found' });
    res.json(jcRows[0]);
  });
};

exports.createJobCard = async (req, res) => {
  try {
    const {
      wo_id, item_id, customer_id, fb_id, compound_weight_required,
      mould_id, machine_id, planned_qty, shots_required,
      moulding_temp, moulding_pressure, curing_time, planned_start, planned_end,
      preform_weight_g, degassing_cycles
    } = req.body;

    if (!wo_id || !item_id || !fb_id || !mould_id || !machine_id || !planned_qty) {
      return res.status(400).json({ message: 'Missing required job card parameters.' });
    }

    const jc_number = await generateJobCardNumber();

    const sql = `
      INSERT INTO moulding_job_cards (
        jc_number, wo_id, item_id, customer_id, fb_id, compound_weight_required,
        mould_id, machine_id, planned_qty, shots_required, moulding_temp, moulding_pressure,
        curing_time, preform_weight_g, degassing_cycles, planned_start, planned_end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `;

    db.query(
      sql,
      [
        jc_number, wo_id, item_id, customer_id || null, fb_id, compound_weight_required,
        mould_id, machine_id, planned_qty, shots_required, moulding_temp || 160, moulding_pressure || 150,
        curing_time || 4, preform_weight_g || 150, degassing_cycles || 2, planned_start, planned_end
      ],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to create job card', error: err.message });
        res.status(210).json({ message: 'Job Card created successfully!', jc_id: result.insertId, jc_number });
      }
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate job card number', error: err.message });
  }
};

exports.startJobCardProduction = (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE moulding_job_cards SET status = 'In Progress', actual_start = NOW() WHERE jc_id = ?`;
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to start job card', error: err.message });
    res.json({ message: 'Moulding job card started.' });
  });
};

exports.completeJobCardProduction = (req, res) => {
  const { id } = req.params;
  
  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    // Fetch job card details
    db.query('SELECT jc_number, wo_id, item_id, machine_id, planned_qty FROM moulding_job_cards WHERE jc_id = ?', [id], (err, rows) => {
      if (err || rows.length === 0) {
        return db.rollback(() => res.status(404).json({ message: 'Job card not found', error: err?.message }));
      }
      const { jc_number, wo_id, item_id, machine_id, planned_qty } = rows[0];
      const wipBatchNumber = `WIP-${jc_number}`;

      // Get actual good parts produced from entries
      db.query(
        'SELECT COALESCE(SUM(good_parts), 0) AS total_good FROM moulding_production_entries WHERE jc_id = ?',
        [id],
        (errSum, sumRows) => {
          if (errSum) return db.rollback(() => res.status(500).json({ message: 'Failed to get production summary', error: errSum.message }));
          const totalGood = sumRows[0].total_good || planned_qty;

          // Update Job Card status + store WIP batch number
          db.query(
            'UPDATE moulding_job_cards SET status = "Completed", actual_end = NOW(), wip_batch_number = ? WHERE jc_id = ?',
            [wipBatchNumber, id],
            (err2) => {
              if (err2) {
                // If wip_batch_number column doesn't exist yet, fall back without it
                db.query('UPDATE moulding_job_cards SET status = "Completed", actual_end = NOW() WHERE jc_id = ?', [id], (err2b) => {
                  if (err2b) return db.rollback(() => res.status(500).json({ message: 'Failed to update job card', error: err2b.message }));
                  continueWorkOrderUpdate();
                });
              } else {
                continueWorkOrderUpdate();
              }
            }
          );

          function continueWorkOrderUpdate() {
            // Auto-increment produced_qty in linked work order
            db.query(
              'UPDATE work_orders SET produced_qty = produced_qty + ? WHERE wo_id = ?',
              [totalGood, wo_id],
              (err3) => {
                if (err3) return db.rollback(() => res.status(500).json({ message: 'Failed to update work order', error: err3.message }));

                // Insert into main batches table to make it visible in QC queue
                const createdBy = req.user ? req.user.user_id : null;
                db.query(
                  `INSERT INTO batches (batch_number, wo_id, item_id, machine_id, quantity, current_stage_id, status, created_by, created_at)
                   VALUES (?, ?, ?, ?, ?, 2, 'QC Hold', ?, NOW())`,
                  [wipBatchNumber, wo_id, item_id, machine_id, totalGood, createdBy],
                  (errBatch) => {
                    if (errBatch) console.error('Failed to create batch record in database:', errBatch);

                    db.commit((commitErr) => {
                      if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                      res.json({
                        message: 'Moulding job card completed successfully!',
                        wip_batch_number: wipBatchNumber,
                        total_good: totalGood
                      });
                    });
                  }
                );
              }
            );
          }
        }
      );
    });
  });
};


// ─── PART 3: PRODUCTION ENTRIES & REJECTIONS ─────────────────────────────

exports.saveProductionEntry = (req, res) => {
  const {
    jc_id, machine_id, operator_id, shift, shots_completed,
    good_parts, rejected_parts, downtime_minutes, downtime_reason, remarks,
    rejections // Array of objects: { reason_code, rejected_qty }
  } = req.body;

  if (!jc_id || !machine_id || !operator_id || !shift || shots_completed === undefined) {
    return res.status(400).json({ message: 'Missing required production parameters.' });
  }

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    // 1. Insert production entry header
    const entrySql = `
      INSERT INTO moulding_production_entries (jc_id, machine_id, operator_id, shift, shots_completed, good_parts, rejected_parts, downtime_minutes, downtime_reason, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      entrySql,
      [jc_id, machine_id, operator_id, shift, shots_completed, good_parts, rejected_parts, downtime_minutes || 0, downtime_reason || null, remarks || ''],
      async (err, result) => {
        if (err) {
          return db.rollback(() => res.status(500).json({ message: 'Failed to insert production entry', error: err.message }));
        }

        const entryId = result.insertId;

        try {
          // 2. Insert detailed rejections if present
          if (rejections && rejections.length > 0) {
            const rejectionsValues = rejections.map(r => [entryId, r.reason_code, r.rejected_qty, r.remarks || '']);
            const rejectionsSql = `INSERT INTO moulding_rejection_log (entry_id, rejection_reason_code, rejected_qty, remarks) VALUES ?`;
            
            await new Promise((resolve, reject) => {
              db.query(rejectionsSql, [rejectionsValues], (errRej) => {
                if (errRej) return reject(errRej);
                resolve();
              });
            });
          }

          // 3. Increment mold shots count automatically
          db.query('SELECT mould_id, fb_id, compound_weight_required FROM moulding_job_cards WHERE jc_id = ?', [jc_id], async (errJc, jcRows) => {
            if (errJc || jcRows.length === 0) {
              return db.rollback(() => res.status(404).json({ message: 'Job card details lookup failed.' }));
            }
            const { mould_id, fb_id, compound_weight_required } = jcRows[0];

            // Update mould shots count and set status if shots exceed maintenance trigger
            await new Promise((resolve, reject) => {
              db.query('SELECT shots_used, maintenance_due_shots FROM moulds WHERE mould_id = ?', [mould_id], (errMld, mldRows) => {
                if (errMld || mldRows.length === 0) return reject(errMld || new Error('Mould not found'));
                
                const newShots = mldRows[0].shots_used + parseInt(shots_completed);
                const isOverdue = newShots >= mldRows[0].maintenance_due_shots;
                const statusUpdate = isOverdue ? 'Under Maintenance' : 'Available';

                db.query(
                  'UPDATE moulds SET shots_used = ?, status = ? WHERE mould_id = ?',
                  [newShots, statusUpdate, mould_id],
                  (errMldUpd) => {
                    if (errMldUpd) return reject(errMldUpd);
                    resolve();
                  }
                );
              });
            });

            // 4. Deduct Compound stock from stock_positions
            // Fetch compound item_id linked to the final batch (Semi Finished category)
            db.query('SELECT item_id, fb_number FROM final_batches WHERE fb_id = ?', [fb_id], async (errFb, fbRows) => {
              if (errFb || fbRows.length === 0) {
                return db.rollback(() => res.status(404).json({ message: 'Final batch compound lookup failed.' }));
              }
              const { item_id, fb_number } = fbRows[0];
              
              // Calculate proportional compound weight consumed in this shift run
              // Weight Consumed = (shots_completed / job_card.shots_required) * job_card.compound_weight_required
              db.query('SELECT shots_required FROM moulding_job_cards WHERE jc_id = ?', [jc_id], async (errJc2, jcRows2) => {
                if (errJc2 || jcRows2.length === 0) {
                  return db.rollback(() => res.status(404).json({ message: 'Job card shots lookup failed.' }));
                }
                const totalShots = jcRows2[0].shots_required;
                const consumedWeight = (parseInt(shots_completed) / totalShots) * parseFloat(compound_weight_required);

                // Deduct compound rubber slab stock from Raw Material/Compound Store (Store 1)
                try {
                  await updateStock(
                    db,
                    item_id,
                    1, // Store 1: Raw Material Store / Compound Store
                    -consumedWeight, // deduct
                    'Issue',
                    `Moulding Consume - ${fb_number}`,
                    operator_id
                  );
                } catch (stockErr) {
                  console.error('Stock deduction warning:', stockErr.message);
                }

                // 5. Update work order produced quantity, pending quantity, and status in real-time
                db.query('SELECT wo_id FROM moulding_job_cards WHERE jc_id = ?', [jc_id], (errWo, jcRows) => {
                  if (!errWo && jcRows.length > 0) {
                    const woId = jcRows[0].wo_id;
                    db.query(
                      `UPDATE work_orders 
                       SET produced_qty = produced_qty + ?, 
                           pending_qty = GREATEST(0, planned_qty - (produced_qty + ?)),
                           status = 'In Progress', 
                           actual_start = COALESCE(actual_start, NOW()) 
                       WHERE wo_id = ?`,
                      [parseInt(good_parts), parseInt(good_parts), woId],
                      (errWoUpd) => {
                        if (errWoUpd) console.error('Failed to update work order real-time stats:', errWoUpd.message);
                        
                        // Commit Transaction
                        db.commit((commitErr) => {
                          if (commitErr) {
                            return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                          }
                          res.json({ message: 'Production entry saved successfully, stock deducted, mould shots updated, and work order synced!' });
                        });
                      }
                    );
                  } else {
                    // Commit Transaction fallback if no job card wo_id
                    db.commit((commitErr) => {
                      if (commitErr) {
                        return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                      }
                      res.json({ message: 'Production entry saved successfully, stock deducted, and mould shots updated!' });
                    });
                  }
                });
              });
            });
          });
        } catch (e) {
          db.rollback(() => res.status(500).json({ message: 'Failed to process database updates', error: e.message }));
        }
      }
    );
  });
};

exports.getEntriesByJobCard = (req, res) => {
  const { jc_id } = req.params;
  const sql = `
    SELECT pe.*, u.name as operator_name, m.machine_code 
    FROM moulding_production_entries pe
    JOIN users u ON pe.operator_id = u.user_id
    JOIN machines m ON pe.machine_id = m.machine_id
    WHERE pe.jc_id = ?
    ORDER BY pe.entry_date DESC
  `;
  db.query(sql, [jc_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to load entries', error: err.message });
    res.json(results);
  });
};

exports.getProductionSummary = (req, res) => {
  const { jc_id } = req.params;
  const sql = `
    SELECT 
      COALESCE(SUM(shots_completed), 0) as total_shots,
      COALESCE(SUM(good_parts), 0) as total_good,
      COALESCE(SUM(rejected_parts), 0) as total_rejected,
      COALESCE(SUM(downtime_minutes), 0) as total_downtime,
      COUNT(*) as entry_count
    FROM moulding_production_entries
    WHERE jc_id = ?
  `;
  db.query(sql, [jc_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to load summary', error: err.message });
    res.json(results[0] || { total_shots: 0, total_good: 0, total_rejected: 0, total_downtime: 0, entry_count: 0 });
  });
};


// ─── PART 4: PURGE LOGS ──────────────────────────────────────────────────

exports.logPurge = (req, res) => {
  const { machine_id, operator_id, purge_reason, compound_used, quantity_kg } = req.body;

  if (!machine_id || !operator_id || !purge_reason || !compound_used || !quantity_kg) {
    return res.status(400).json({ message: 'Missing required purging parameters.' });
  }

  const sql = `
    INSERT INTO moulding_purge_log (machine_id, operator_id, purge_reason, compound_used, quantity_kg)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [machine_id, operator_id, purge_reason, compound_used, quantity_kg],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to record purge log', error: err.message });
      res.status(210).json({ message: 'Purge waste logged successfully.' });
    }
  );
};

exports.getPurgeHistory = (req, res) => {
  const { machine_id } = req.params;
  const sql = `
    SELECT p.*, u.name as operator_name 
    FROM moulding_purge_log p
    JOIN users u ON p.operator_id = u.user_id
    WHERE p.machine_id = ?
    ORDER BY p.purge_date DESC
  `;
  db.query(sql, [machine_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve purge logs', error: err.message });
    res.json(results);
  });
};

// Retrieve all purge logs across all machines
exports.getAllPurgeLogs = (req, res) => {
  const sql = `
    SELECT p.*, u.name as operator_name, mac.machine_name, mac.machine_code
    FROM moulding_purge_log p
    LEFT JOIN users u ON p.operator_id = u.user_id
    LEFT JOIN machines mac ON p.machine_id = mac.machine_id
    ORDER BY p.purge_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve all purge logs', error: err.message });
    res.json(results);
  });
};

// Expose released work orders for Moulding
exports.getActiveWorkOrders = (req, res) => {
  const sql = `
    SELECT wo.*, i.item_code, i.item_name, c.customer_name
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE wo.status IN ('Released', 'In Progress')
    ORDER BY wo.wo_number ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve work orders', error: err.message });
    res.json(results);
  });
};

// Expose approved final batches from mixing compound store
exports.getApprovedFinalBatches = (req, res) => {
  const sql = `
    SELECT fb.*, i.item_name, i.item_code
    FROM final_batches fb
    JOIN items i ON fb.item_id = i.item_id
    WHERE fb.status = 'Approved'
    ORDER BY fb.fb_number ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve approved final batches', error: err.message });
    res.json(results);
  });
};

// Expose active moulding machines (all of Molding type)
exports.getMouldingMachines = (req, res) => {
  const sql = `
    SELECT * FROM machines 
    WHERE machine_type = 'Molding'
    ORDER BY machine_code ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve moulding machines', error: err.message });
    res.json(results);
  });
};

// Create a new moulding press machine
exports.createMouldingMachine = (req, res) => {
  const {
    machine_code, machine_name, capacity_tons, platen_length, platen_width,
    daylights, heating_type, max_temperature, max_pressure, ideal_cycle_time, status
  } = req.body;

  if (!machine_code || !machine_name) {
    return res.status(400).json({ message: 'Machine Code and Name are required.' });
  }

  const sql = `
    INSERT INTO machines (
      machine_code, machine_name, machine_type, capacity_tons, platen_length, platen_width,
      daylights, heating_type, max_temperature, max_pressure, ideal_cycle_time, status
    ) VALUES (?, ?, 'Molding', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      machine_code, machine_name, capacity_tons || null, platen_length || null, platen_width || null,
      daylights || 1, heating_type || 'Electric', max_temperature || 200, max_pressure || 200,
      ideal_cycle_time || 5, status || 'Active'
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Failed to create machine', error: err.message });
      res.status(201).json({ message: 'Machine registered successfully!', machine_id: result.insertId });
    }
  );
};

// Lookup final batch by barcode
exports.lookupFinalBatch = (req, res) => {
  const { barcode } = req.params;
  const sql = `
    SELECT fb.*, i.item_name, i.item_code
    FROM final_batches fb
    JOIN items i ON fb.item_id = i.item_id
    WHERE fb.fb_number = ?
  `;
  db.query(sql, [barcode], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database lookup error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Compound batch barcode not found in database.' });
    res.json(results[0]);
  });
};

// Lookup mould by barcode (mould_code)
exports.lookupMouldByCode = (req, res) => {
  const { code } = req.params;
  const sql = `
    SELECT m.*, i.item_name, i.item_code
    FROM moulds m
    JOIN items i ON m.item_id = i.item_id
    WHERE m.mould_code = ?
  `;
  db.query(sql, [code], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database lookup error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Mould barcode code not found in database.' });
    res.json(results[0]);
  });
};

// Log Standalone Rejection from barcode scan
exports.logStandaloneRejection = (req, res) => {
  const { jc_id, machine_id, operator_id, shift, reason_code, rejected_qty, remarks } = req.body;
  
  if (!jc_id || !operator_id || !reason_code || !rejected_qty) {
    return res.status(400).json({ message: 'Missing required rejection parameters.' });
  }
  
  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });
    
    const entrySql = `
      INSERT INTO moulding_production_entries (jc_id, machine_id, operator_id, shift, shots_completed, good_parts, rejected_parts, downtime_minutes, downtime_reason, remarks)
      VALUES (?, ?, ?, ?, 0, 0, ?, 0, null, ?)
    `;
    
    db.query(entrySql, [jc_id, machine_id || null, operator_id, shift || 'Morning', rejected_qty, remarks || 'Standalone scan rejection'], (err, result) => {
      if (err) return db.rollback(() => res.status(500).json({ message: 'Failed to log rejection header', error: err.message }));
      
      const entryId = result.insertId;
      const rejectionsSql = `INSERT INTO moulding_rejection_log (entry_id, rejection_reason_code, rejected_qty, remarks) VALUES (?, ?, ?, ?)`;
      
      db.query(rejectionsSql, [entryId, reason_code, rejected_qty, remarks || ''], (err2) => {
        if (err2) return db.rollback(() => res.status(500).json({ message: 'Failed to log rejection details', error: err2.message }));
        
        db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
          res.json({ message: 'Rejection logged successfully against the scanned batch!', entry_id: entryId });
        });
      });
    });
  });
};

// Log Next Stage Entry (Trimming/QC) for a scanned WIP batch
exports.nextStageInward = (req, res) => {
  const { batch_number, stage_id, remarks } = req.body;
  const moved_by = req.user ? req.user.user_id : null;

  if (!batch_number) {
    return res.status(400).json({ message: 'WIP batch number is required.' });
  }

  const cleanBatchNumber = batch_number.trim();
  const batchNumberWithPrefix = cleanBatchNumber.startsWith('WIP-') ? cleanBatchNumber : `WIP-${cleanBatchNumber}`;

  // 1. Look up batch_id from batches table (support raw or WIP prefixed)
  db.query(
    'SELECT batch_id, quantity, item_id, wo_id, batch_number FROM batches WHERE batch_number = ? OR batch_number = ?',
    [cleanBatchNumber, batchNumberWithPrefix],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
      if (rows.length === 0) {
        return res.status(404).json({ message: `WIP batch "${cleanBatchNumber}" not found. Make sure moulding is completed first.` });
      }

      const { batch_id, quantity, item_id, wo_id, batch_number: resolvedBatchNumber } = rows[0];
      const targetStage = stage_id || 3; // default to stage 3 (Trimming/QC)

      db.beginTransaction((transactionErr) => {
        if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

        // 2. Update current stage in batches table
        db.query(
          'UPDATE batches SET current_stage_id = ?, status = "QC Hold" WHERE batch_id = ?',
          [targetStage, batch_id],
          (err2) => {
            if (err2) return db.rollback(() => res.status(500).json({ message: 'Failed to update batch stage', error: err2.message }));

            // 3. Log movement in batch_movements table
            const remarksStr = remarks || 'Batch inwarded to Trimming/QC stage.';
            db.query(
              'INSERT INTO batch_movements (batch_id, stage_id, entered_at, moved_by, remarks) VALUES (?, ?, NOW(), ?, ?)',
              [batch_id, targetStage, moved_by, remarksStr],
              (err3) => {
                if (err3) return db.rollback(() => res.status(500).json({ message: 'Failed to log stage movement', error: err3.message }));

                db.commit((commitErr) => {
                  if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                  res.json({
                    message: `Batch ${resolvedBatchNumber} successfully inwarded to Trimming/QC!`,
                    batch_id,
                    quantity
                  });
                });
              }
            );
          }
        );
      });
    }
  );
};

// Lookup WIP batch by barcode
exports.lookupWipBatch = (req, res) => {
  const { barcode } = req.params;
  const cleanBarcode = (barcode || '').trim();
  const barcodeWithPrefix = cleanBarcode.startsWith('WIP-') ? cleanBarcode : `WIP-${cleanBarcode}`;
  const sql = `
    SELECT b.*, i.item_name, i.item_code, m.machine_name, m.machine_code
    FROM batches b
    JOIN items i ON b.item_id = i.item_id
    LEFT JOIN machines m ON b.machine_id = m.machine_id
    WHERE b.batch_number = ? OR b.batch_number = ?
  `;
  db.query(sql, [cleanBarcode, barcodeWithPrefix], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database lookup error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: `WIP batch barcode "${cleanBarcode}" not found in database. Ensure moulding is completed.` });
    res.json(results[0]);
  });
};


