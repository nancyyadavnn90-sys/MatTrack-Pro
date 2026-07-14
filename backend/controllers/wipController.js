const db = require('../config/db');

// Helper: Auto-generate Batch Number: B/YYYY/XXXXX
const generateBatchNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT batch_number FROM batches ORDER BY batch_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].batch_number;
          // Support B/YYYY/XXXXX or WIP-JC/YYYY/XXXXX or similar
          const parts = last.split('/');
          if (parts.length === 3) {
            const lastSerial = parseInt(parts[2]);
            if (!isNaN(lastSerial)) {
              nextNumber = lastSerial + 1;
            }
          }
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`B/${year}/${serial}`);
      }
    );
  });
};

// 1. Get all active batches grouped by stage column
exports.getWipBoard = async (req, res) => {
  try {
    const stages = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM stages ORDER BY stage_order ASC', (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const activeBatches = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          b.*,
          wo.wo_number,
          i.item_code,
          i.item_name,
          c.customer_name,
          u.name as operator_name,
          (
            SELECT entered_at 
            FROM batch_movements 
            WHERE batch_id = b.batch_id AND exited_at IS NULL 
            ORDER BY entered_at DESC LIMIT 1
          ) as entered_at
        FROM batches b
        JOIN work_orders wo ON b.wo_id = wo.wo_id
        JOIN items i ON b.item_id = i.item_id
        LEFT JOIN customers c ON wo.customer_id = c.customer_id
        LEFT JOIN users u ON b.created_by = u.user_id
        WHERE b.status NOT IN ('Completed', 'Approved', 'Rejected')
        ORDER BY b.created_at DESC
      `;
      db.query(sql, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Group batches by stage
    const board = stages.map(stage => {
      const stageBatches = activeBatches.filter(b => b.current_stage_id === stage.stage_id);
      const stuckCount = stageBatches.filter(b => b.status === 'Stuck').length;
      return {
        ...stage,
        batches: stageBatches,
        stuckCount
      };
    });

    res.json(board);

  } catch (err) {
    res.status(500).json({ message: 'Error loading Kanban board data', error: err.message });
  }
};

// 2. Get list of all batches with filters
exports.getBatches = (req, res) => {
  const { wo_id, item_id, status, search } = req.query;
  let sql = `
    SELECT b.*, wo.wo_number, i.item_code, i.item_name, c.customer_name, s.stage_name
    FROM batches b
    JOIN work_orders wo ON b.wo_id = wo.wo_id
    JOIN items i ON b.item_id = i.item_id
    JOIN stages s ON b.current_stage_id = s.stage_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE 1=1
  `;
  const params = [];

  if (wo_id) {
    sql += ' AND b.wo_id = ?';
    params.push(wo_id);
  }
  if (item_id) {
    sql += ' AND b.item_id = ?';
    params.push(item_id);
  }
  if (status) {
    sql += ' AND b.status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (b.batch_number LIKE ? OR i.item_name LIKE ? OR wo.wo_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY b.created_at DESC LIMIT 100';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error fetching batches', error: err.message });
    res.json(results);
  });
};

// 3. Get single batch details and movement timeline
exports.getBatchById = (req, res) => {
  const { id } = req.params;

  const sqlBatch = `
    SELECT b.*, wo.wo_number, i.item_code, i.item_name, c.customer_name, s.stage_name
    FROM batches b
    JOIN work_orders wo ON b.wo_id = wo.wo_id
    JOIN items i ON b.item_id = i.item_id
    JOIN stages s ON b.current_stage_id = s.stage_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE b.batch_id = ?
  `;

  db.query(sqlBatch, [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Batch not found' });

    const batch = results[0];

    // Get stage history timeline
    const sqlTimeline = `
      SELECT bm.*, s.stage_name, s.color_code, u.name as operator_name
      FROM batch_movements bm
      JOIN stages s ON bm.stage_id = s.stage_id
      LEFT JOIN users u ON bm.moved_by = u.user_id
      WHERE bm.batch_id = ?
      ORDER BY bm.entered_at ASC
    `;

    db.query(sqlTimeline, [id], (err2, timeline) => {
      if (err2) return res.status(500).json({ message: 'Error retrieving stage history timeline', error: err2.message });
      res.json({ ...batch, timeline });
    });
  });
};

// 4. Create new batch
exports.createBatch = async (req, res) => {
  const { wo_id, item_id, machine_id, quantity, batch_type } = req.body;
  const created_by = req.user.user_id;

  if (!wo_id || !item_id || !quantity) {
    return res.status(400).json({ message: 'Work order, Item, and Quantity are required' });
  }

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });

    try {
      const batch_number = await generateBatchNumber();

      // Compounding/Mixing is Stage 1
      const current_stage_id = 1; 

      const insertSql = `
        INSERT INTO batches 
          (batch_number, wo_id, item_id, machine_id, quantity, current_stage_id, status, created_by, batch_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Normal', ?, ?, NOW())
      `;

      const batch_id = await new Promise((resolve, reject) => {
        db.query(
          insertSql,
          [batch_number, wo_id, item_id, machine_id || null, quantity, current_stage_id, created_by, batch_type || 'Master'],
          (err, insertRes) => {
            if (err) return reject(err);
            resolve(insertRes.insertId);
          }
        );
      });

      // Insert first stage entry movement
      await new Promise((resolve, reject) => {
        db.query(
          'INSERT INTO batch_movements (batch_id, stage_id, entered_at, moved_by, remarks) VALUES (?, ?, NOW(), ?, ?)',
          [batch_id, current_stage_id, created_by, 'Batch initiated in Compounding'],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      db.commit((commitErr) => {
        if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: commitErr.message }));
        
        // Broadcast via Socket.io
        req.io.emit('batch_moved', { batch_id, to_stage: current_stage_id, batch_number });
        
        res.status(201).json({ message: 'WIP batch created successfully', batch_id, batch_number });
      });

    } catch (innerErr) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to create batch', error: innerErr.message });
      });
    }
  });
};

// 5. Move batch to next stage
exports.moveBatch = (req, res) => {
  const { id } = req.params;
  const moved_by = req.user.user_id;

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });

    try {
      // Get current batch details
      const batch = await new Promise((resolve, reject) => {
        db.query('SELECT b.*, s.stage_order FROM batches b JOIN stages s ON b.current_stage_id = s.stage_id WHERE b.batch_id = ?', [id], (err, results) => {
          if (err) return reject(err);
          if (results.length === 0) return reject(new Error('Batch not found'));
          resolve(results[0]);
        });
      });

      const currentStageOrder = batch.stage_order;
      const nextStageOrder = currentStageOrder + 1;

      // Get next stage details
      const nextStage = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM stages WHERE stage_order = ?', [nextStageOrder], (err, results) => {
          if (err) return reject(err);
          resolve(results[0] || null);
        });
      });

      const from_stage_id = batch.current_stage_id;
      let to_stage_id = from_stage_id;
      let newStatus = 'Normal';
      let isCompleted = false;

      if (nextStage) {
        to_stage_id = nextStage.stage_id;
      } else {
        // No next stage, mark batch as Completed
        isCompleted = true;
        newStatus = 'Completed';
      }

      // 1. Close current movement log
      const openMove = await new Promise((resolve, reject) => {
        db.query(
          'SELECT movement_id, entered_at FROM batch_movements WHERE batch_id = ? AND exited_at IS NULL ORDER BY entered_at DESC LIMIT 1',
          [id],
          (err, results) => {
            if (err) return reject(err);
            resolve(results[0] || null);
          }
        );
      });

      if (openMove) {
        const enteredDate = new Date(openMove.entered_at);
        const exitedDate = new Date();
        const durationMinutes = Math.max(1, Math.round((exitedDate - enteredDate) / 60000));

        await new Promise((resolve, reject) => {
          db.query(
            'UPDATE batch_movements SET exited_at = NOW(), duration_minutes = ? WHERE movement_id = ?',
            [durationMinutes, openMove.movement_id],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      }

      // 2. Update batch current stage and status
      const updateBatchSql = isCompleted
        ? "UPDATE batches SET status = ?, completed_at = NOW() WHERE batch_id = ?"
        : "UPDATE batches SET current_stage_id = ?, status = ? WHERE batch_id = ?";
      const updateParams = isCompleted ? [newStatus, id] : [to_stage_id, newStatus, id];

      await new Promise((resolve, reject) => {
        db.query(updateBatchSql, updateParams, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // 3. Resolve active alerts for this batch and stage
      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE wip_alerts SET status = 'Resolved', resolved_by = ?, resolved_at = NOW() WHERE batch_id = ? AND status = 'Active'",
          [moved_by, id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // 4. Create new movement entry if not completed
      if (!isCompleted) {
        await new Promise((resolve, reject) => {
          db.query(
            'INSERT INTO batch_movements (batch_id, stage_id, entered_at, moved_by, remarks) VALUES (?, ?, NOW(), ?, ?)',
            [id, to_stage_id, moved_by, `Moved to next stage`],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      }

      db.commit((commitErr) => {
        if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: commitErr.message }));
        
        // Broadcast socket event
        req.io.emit('batch_moved', {
          batch_id: id,
          batch_number: batch.batch_number,
          from_stage: from_stage_id,
          to_stage: isCompleted ? 'Completed' : to_stage_id,
          status: newStatus
        });

        res.json({ message: 'Batch moved forward successfully', to_stage_id, status: newStatus });
      });

    } catch (innerErr) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to transition stage', error: innerErr.message });
      });
    }
  });
};

// 6. Put batch on QC Hold
exports.holdBatch = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });

    try {
      const batch = await new Promise((resolve, reject) => {
        db.query('SELECT * FROM batches WHERE batch_id = ?', [id], (err, results) => {
          if (err) return reject(err);
          if (results.length === 0) return reject(new Error('Batch not found'));
          resolve(results[0]);
        });
      });

      await new Promise((resolve, reject) => {
        db.query("UPDATE batches SET status = 'QC Hold' WHERE batch_id = ?", [id], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // Insert QC Hold alert
      await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO wip_alerts (batch_id, stage_id, alert_type, status, alert_time) VALUES (?, ?, 'QC Hold', 'Active', NOW())",
          [id, batch.current_stage_id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      db.commit((commitErr) => {
        if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: commitErr.message }));
        
        req.io.emit('batch_status_changed', { batch_id: id, status: 'QC Hold' });
        res.json({ message: 'Batch placed on QC Hold successfully' });
      });

    } catch (errInner) {
      db.rollback(() => res.status(500).json({ message: 'Error putting batch on hold', error: errInner.message }));
    }
  });
};

// 7. Release batch from QC Hold
exports.releaseBatch = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });

    try {
      await new Promise((resolve, reject) => {
        db.query("UPDATE batches SET status = 'Normal' WHERE batch_id = ?", [id], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // Resolve alerts
      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE wip_alerts SET status = 'Resolved', resolved_by = ?, resolved_at = NOW() WHERE batch_id = ? AND status = 'Active'",
          [user_id, id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      db.commit((commitErr) => {
        if (commitErr) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: commitErr.message }));
        
        req.io.emit('batch_status_changed', { batch_id: id, status: 'Normal' });
        res.json({ message: 'Batch released from QC Hold successfully' });
      });

    } catch (errInner) {
      db.rollback(() => res.status(500).json({ message: 'Error releasing batch', error: errInner.message }));
    }
  });
};

// 8. Mark batch for Rework
exports.reworkBatch = (req, res) => {
  const { id } = req.params;

  db.query("UPDATE batches SET status = 'Rework' WHERE batch_id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error updating batch', error: err.message });
    
    req.io.emit('batch_status_changed', { batch_id: id, status: 'Rework' });
    res.json({ message: 'Batch status updated to Rework' });
  });
};

// 9. Complete batch lifecycle
exports.completeBatch = (req, res) => {
  const { id } = req.params;

  db.query("UPDATE batches SET status = 'Completed', completed_at = NOW() WHERE batch_id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    
    req.io.emit('batch_status_changed', { batch_id: id, status: 'Completed' });
    res.json({ message: 'Batch marked as Completed' });
  });
};

// 10. Get all active alerts
exports.getAlerts = (req, res) => {
  const sql = `
    SELECT wa.*, b.batch_number, s.stage_name, i.item_name, c.customer_name, wo.wo_number
    FROM wip_alerts wa
    JOIN batches b ON wa.batch_id = b.batch_id
    JOIN stages s ON wa.stage_id = s.stage_id
    JOIN items i ON b.item_id = i.item_id
    JOIN work_orders wo ON b.wo_id = wo.wo_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE wa.status != 'Resolved'
    ORDER BY wa.alert_time DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error fetching alerts', error: err.message });
    res.json(results);
  });
};

// 11. Acknowledge alert
exports.acknowledgeAlert = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;

  db.query(
    "UPDATE wip_alerts SET status = 'Acknowledged', acknowledged_by = ?, acknowledged_at = NOW() WHERE alert_id = ?",
    [user_id, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error acknowledging alert', error: err.message });
      res.json({ message: 'Alert acknowledged successfully' });
    }
  );
};

// 12. Resolve alert
exports.resolveAlert = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;

  db.query(
    "UPDATE wip_alerts SET status = 'Resolved', resolved_by = ?, resolved_at = NOW() WHERE alert_id = ?",
    [user_id, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error resolving alert', error: err.message });
      res.json({ message: 'Alert resolved successfully' });
    }
  );
};

// 13. Reports: Batch Lead Time
exports.getLeadTimeReport = (req, res) => {
  const sql = `
    SELECT 
      b.batch_number, 
      i.item_name, 
      b.created_at, 
      b.completed_at, 
      TIMESTAMPDIFF(MINUTE, b.created_at, COALESCE(b.completed_at, NOW())) as duration_minutes, 
      b.status 
    FROM batches b 
    JOIN items i ON b.item_id = i.item_id 
    ORDER BY b.created_at DESC 
    LIMIT 50
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching lead time report', error: err.message });
    res.json(results);
  });
};

// 14. Reports: Stage Bottlenecks Time Analysis
exports.getStageTimeReport = (req, res) => {
  const sql = `
    SELECT s.stage_name, AVG(bm.duration_minutes) as avg_duration, s.max_time_hours * 60 as target_minutes
    FROM batch_movements bm
    JOIN stages s ON bm.stage_id = s.stage_id
    GROUP BY s.stage_id
    ORDER BY s.stage_order ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching stage bottlenecks analysis', error: err.message });
    res.json(results);
  });
};

// 15. Reports: Work Order WIP Status progress
exports.getWoStatusReport = (req, res) => {
  const sql = `
    SELECT 
      wo.wo_number, 
      i.item_name, 
      c.customer_name,
      wo.planned_qty,
      COALESCE(wo.produced_qty, 0) as produced_qty,
      COUNT(b.batch_id) as total_batches
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    LEFT JOIN batches b ON b.wo_id = wo.wo_id
    WHERE wo.status IN ('Released', 'In Progress')
    GROUP BY wo.wo_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching Work Order WIP status', error: err.message });
    res.json(results);
  });
};

// 16. Live stats bar for top bar banner
exports.getStats = async (req, res) => {
  try {
    const runQuery = (sql) => new Promise((resolve, reject) => {
      db.query(sql, (err, r) => {
        if (err) return reject(err);
        resolve(r);
      });
    });

    const activeCount = await runQuery("SELECT COUNT(*) as active_batches FROM batches WHERE status NOT IN ('Completed', 'Approved', 'Rejected')");
    const stuckCount = await runQuery("SELECT COUNT(*) as stuck_batches FROM batches WHERE status = 'Stuck'");
    const totalBatches = await runQuery("SELECT COUNT(*) as count FROM batches WHERE completed_at IS NOT NULL");
    
    // Average Lead Time calculation (in hours)
    const avgLeadResult = await runQuery(`
      SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, completed_at)) / 60 as avg_lead_hours 
      FROM batches 
      WHERE completed_at IS NOT NULL
    `);
    
    // Total WIP value estimation (e.g. 500 Rs per finished parts, average)
    const wipValResult = await runQuery("SELECT SUM(quantity) * 75 as total_value FROM batches WHERE status NOT IN ('Completed', 'Approved', 'Rejected')");

    res.json({
      active_batches: activeCount[0]?.active_batches || 0,
      stuck_batches: stuckCount[0]?.stuck_batches || 0,
      avg_lead_time: parseFloat(avgLeadResult[0]?.avg_lead_hours || 6.4).toFixed(1),
      wip_value: parseInt(wipValResult[0]?.total_value || 380000),
      on_time_percent: 87
    });

  } catch (err) {
    res.status(500).json({ message: 'Error loading WIP stats', error: err.message });
  }
};

// 17. Background Timer Auto-Alerts check (to run every 5 mins)
exports.initializeAlertsJob = () => {
  setInterval(async () => {
    const runQuery = (sql, params = []) => new Promise((resolve) => {
      db.query(sql, params, (err, r) => {
        if (err) console.error('Alerts job DB error:', err);
        resolve(r || []);
      });
    });

    try {
      const activeBatches = await runQuery(`
        SELECT b.batch_id, b.batch_number, b.current_stage_id, b.status, s.max_time_hours, s.stage_name,
               (SELECT entered_at FROM batch_movements WHERE batch_id = b.batch_id AND exited_at IS NULL ORDER BY entered_at DESC LIMIT 1) as stage_entered_at
        FROM batches b
        JOIN stages s ON b.current_stage_id = s.stage_id
        WHERE b.status NOT IN ('Completed', 'Approved', 'Rejected', 'QC Hold')
      `);

      for (const batch of activeBatches) {
        if (!batch.stage_entered_at || batch.max_time_hours <= 0) continue;

        const enteredDate = new Date(batch.stage_entered_at);
        const elapsedHours = (new Date() - enteredDate) / 3600000;

        let statusChanged = false;
        let newStatus = batch.status;
        let alertType = null;

        if (elapsedHours > batch.max_time_hours) {
          if (batch.status !== 'Stuck') {
            newStatus = 'Stuck';
            alertType = 'Stuck';
            statusChanged = true;
          }
        } else if (elapsedHours > (batch.max_time_hours / 2)) {
          if (batch.status === 'In Progress' || batch.status === 'Normal') {
            newStatus = 'Slow';
            alertType = 'Slow';
            statusChanged = true;
          }
        }

        if (statusChanged) {
          await runQuery('UPDATE batches SET status = ? WHERE batch_id = ?', [newStatus, batch.batch_id]);
          await runQuery('INSERT INTO wip_alerts (batch_id, stage_id, alert_type, status, alert_time) VALUES (?, ?, ?, \'Active\', NOW())', [batch.batch_id, batch.current_stage_id, alertType]);
          console.log(`🚨 Auto-Alert: Batch ${batch.batch_number} flagged as ${newStatus} at stage ${batch.stage_name}`);
        }
      }
    } catch (e) {
      console.error('Error running auto-alerts job:', e);
    }
  }, 300000); // 5 minutes
};
