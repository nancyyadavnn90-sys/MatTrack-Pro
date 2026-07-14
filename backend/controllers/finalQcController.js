const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// Helper: Auto-generate FQC Number
const generateFQCNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT fqc_number FROM final_qc_inspections ORDER BY fqc_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].fqc_number;
          // Extract serial number from FQC/YYYY/XXXXX
          const parts = last.split('/');
          const lastSerial = parseInt(parts[2] || '0');
          if (!isNaN(lastSerial)) {
            nextNumber = lastSerial + 1;
          }
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`FQC/${year}/${serial}`);
      }
    );
  });
};

// Helper: Auto-generate FG Receipt Number
const generateFGRNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT fgr_number FROM fg_receipts ORDER BY fgr_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].fgr_number;
          const parts = last.split('/');
          const lastSerial = parseInt(parts[2] || '0');
          if (!isNaN(lastSerial)) {
            nextNumber = lastSerial + 1;
          }
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`FGR/${year}/${serial}`);
      }
    );
  });
};

// Helper: Auto-generate QC Inspection Number
const generateInspectionNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT inspection_number FROM qc_inspections ORDER BY inspection_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].inspection_number;
          const parts = last.split('/');
          const lastSerial = parseInt(parts[2] || '0');
          if (!isNaN(lastSerial)) {
            nextNumber = lastSerial + 1;
          }
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`QC/${year}/${serial}`);
      }
    );
  });
};

// Helper: Auto-generate NC Number
const generateNCNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT nc_number FROM non_conformances ORDER BY nc_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].nc_number;
          const parts = last.split('/');
          const lastSerial = parseInt(parts[2] || '0');
          if (!isNaN(lastSerial)) {
            nextNumber = lastSerial + 1;
          }
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`NC/${year}/${serial}`);
      }
    );
  });
};

// 1. Get Work Orders for linking (In Progress, Released, or Completed)
exports.getLinkableWorkOrders = (req, res) => {
  const { wo_number } = req.query;
  let sql = `
    SELECT 
      wo.wo_id,
      wo.wo_number,
      wo.item_id,
      wo.planned_qty,
      COALESCE((
        SELECT SUM(mpe.good_parts)
        FROM moulding_production_entries mpe
        JOIN moulding_job_cards jc ON mpe.jc_id = jc.jc_id
        WHERE jc.wo_id = wo.wo_id
      ), 0) as produced_qty,
      wo.status,
      i.item_code,
      i.item_name,
      i.unit,
      c.customer_name
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE wo.status IN ('Released', 'In Progress', 'Completed')
  `;

  const params = [];
  if (wo_number) {
    sql += ` AND wo.wo_number = ?`;
    params.push(wo_number);
  }

  sql += ` ORDER BY wo.wo_number DESC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    res.json(results);
  });
};

// 2. Submit Final QC Inspection
exports.createFinalQC = (req, res) => {
  const {
    wo_id,
    item_id,
    inspected_qty,
    accepted_qty,
    rejected_qty,
    result, // 'Approved', 'Rejected', 'On Hold'
    remarks,
    defect_type,
    defect_description,
    severity, // 'Minor', 'Major', 'Critical'
    param_od,
    param_id,
    param_height,
    param_weight,
    param_hardness,
    param_tensile,
    param_elongation,
    param_flash,
    param_surface,
    param_colour,
    param_short_mould
  } = req.body;

  const inspected_by = req.user.user_id;

  if (!wo_id || !item_id || inspected_qty === undefined || accepted_qty === undefined || !result) {
    return res.status(400).json({ message: 'Missing required inspection fields' });
  }

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) {
      return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });
    }

    try {
      // 1. Generate numbers
      const fqc_number = await generateFQCNumber();
      const inspection_number = await generateInspectionNumber();
      const year = new Date().getFullYear();

      // Determine result status for qc_inspections mapping
      let qc_result = 'Pending';
      if (result === 'Approved') qc_result = 'Accepted';
      else if (result === 'Rejected') qc_result = 'Rejected';

      // Summarize parameters in remarks string
      const paramSummary = [
        `OD: ${param_od || 'N/A'}`,
        `ID: ${param_id || 'N/A'}`,
        `Height: ${param_height || 'N/A'}`,
        `Weight: ${param_weight || 'N/A'}`,
        `Hardness: ${param_hardness || 'N/A'}`,
        `Tensile: ${param_tensile || 'N/A'}`,
        `Elongation: ${param_elongation || 'N/A'}`,
        `Flash: ${param_flash || 'N/A'}`,
        `Surface: ${param_surface || 'N/A'}`,
        `Colour: ${param_colour || 'N/A'}`,
        `Short Mould: ${param_short_mould || 'N/A'}`
      ].join(', ');
      
      const combinedRemarks = remarks 
        ? `${remarks} | Parameters: [${paramSummary}]` 
        : `Parameters: [${paramSummary}]`;

      // 2. Insert into qc_inspections (so it integrates with the existing system)
      const label_number = `FGL/${year}/${fqc_number.split('/')[2]}`;
      const insertQCQuery = `
        INSERT INTO qc_inspections 
          (inspection_number, inspection_type, item_id, inspected_qty, accepted_qty, rejected_qty, result, inspected_by, inspection_date, remarks, label_number)
        VALUES (?, 'Final', ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
      `;

      const inspection_id = await new Promise((resolve, reject) => {
        db.query(
          insertQCQuery,
          [inspection_number, item_id, inspected_qty, accepted_qty, rejected_qty, qc_result, inspected_by, combinedRemarks, label_number],
          (err, res) => {
            if (err) return reject(err);
            resolve(res.insertId);
          }
        );
      });

      // 3. Insert into final_qc_inspections
      const insertFQCQuery = `
        INSERT INTO final_qc_inspections 
          (fqc_number, inspection_id, wo_id, item_id, inspected_qty, accepted_qty, rejected_qty, result, inspected_by, inspection_date, remarks,
           param_od, param_id, param_height, param_weight, param_hardness, param_tensile, param_elongation,
           param_flash, param_surface, param_colour, param_short_mould)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const fqc_id = await new Promise((resolve, reject) => {
        db.query(
          insertFQCQuery,
          [fqc_number, inspection_id, wo_id, item_id, inspected_qty, accepted_qty, rejected_qty, result, inspected_by, remarks,
           param_od, param_id, param_height, param_weight, param_hardness, param_tensile, param_elongation,
           param_flash, param_surface, param_colour, param_short_mould],
          (err, res) => {
            if (err) return reject(err);
            resolve(res.insertId);
          }
        );
      });

      // 4. Handle Approved state
      if (result === 'Approved') {
        // Update Work Order status to Completed and set actual_end date when FQC is approved
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE work_orders 
             SET status = 'Completed', actual_end = COALESCE(actual_end, NOW()) 
             WHERE wo_id = ?`,
            [wo_id],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      }

      // 5. Handle Rejected state -> raise NCR
      if (result === 'Rejected') {
        const nc_number = await generateNCNumber();
        const insertNCQuery = `
          INSERT INTO non_conformances 
            (nc_number, inspection_id, defect_type, defect_description, qty_affected, severity, status, raised_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, NOW())
        `;

        await new Promise((resolve, reject) => {
          db.query(
            insertNCQuery,
            [nc_number, inspection_id, defect_type || 'Final QC Failure', defect_description || remarks || 'Failed Final QC checks', rejected_qty, severity || 'Major', inspected_by],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      }

      db.commit((commitErr) => {
        if (commitErr) {
          return db.rollback(() => {
            res.status(500).json({ message: 'Commit error', error: commitErr.message });
          });
        }
        res.status(201).json({
          message: 'Final QC inspection submitted successfully',
          fqc_number,
          fqc_id,
          label_number,
          result
        });
      });

    } catch (innerErr) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to process Final QC', error: innerErr.message });
      });
    }
  });
};

// 3. Get FQC inspections history list
exports.getFinalQCInspections = (req, res) => {
  const sql = `
    SELECT 
      fqc.*,
      wo.wo_number,
      i.item_code,
      i.item_name,
      i.unit,
      u.name as inspector_name,
      qci.label_number,
      c.customer_name
    FROM final_qc_inspections fqc
    JOIN work_orders wo ON fqc.wo_id = wo.wo_id
    JOIN items i ON fqc.item_id = i.item_id
    JOIN users u ON fqc.inspected_by = u.user_id
    JOIN qc_inspections qci ON fqc.inspection_id = qci.inspection_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    ORDER BY fqc.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    res.json(results);
  });
};

// 4. Get FQC details by ID
exports.getFinalQCById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      fqc.*,
      wo.wo_number,
      i.item_code,
      i.item_name,
      i.unit,
      u.name as inspector_name,
      qci.label_number,
      qci.inspection_number,
      c.customer_name
    FROM final_qc_inspections fqc
    JOIN work_orders wo ON fqc.wo_id = wo.wo_id
    JOIN items i ON fqc.item_id = i.item_id
    JOIN users u ON fqc.inspected_by = u.user_id
    JOIN qc_inspections qci ON fqc.inspection_id = qci.inspection_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE fqc.fqc_id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'FQC record not found' });
    res.json(results[0]);
  });
};

// 5. Get FQC NCR list
exports.getFinalQCNCRList = (req, res) => {
  const sql = `
    SELECT 
      nc.*,
      fqc.fqc_number,
      fqc.fqc_id,
      wo.wo_number,
      i.item_code,
      i.item_name,
      u.name as inspector_name
    FROM non_conformances nc
    JOIN qc_inspections qci ON nc.inspection_id = qci.inspection_id
    JOIN final_qc_inspections fqc ON qci.inspection_id = fqc.inspection_id
    JOIN work_orders wo ON fqc.wo_id = wo.wo_id
    JOIN items i ON fqc.item_id = i.item_id
    LEFT JOIN users u ON nc.raised_by = u.user_id
    ORDER BY nc.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    res.json(results);
  });
};

// 6. Close NCR / Disposition
exports.closeFinalQCNCR = (req, res) => {
  const { id } = req.params; // nc_id
  const { disposition, root_cause, corrective_action, remarks } = req.body;
  const closed_by = req.user.user_id;

  if (!disposition) {
    return res.status(400).json({ message: 'Disposition decision is required' });
  }

  const sql = `
    UPDATE non_conformances 
    SET disposition = ?, root_cause = ?, corrective_action = ?, remarks = ?, status = 'Closed', closed_by = ?, closed_at = NOW()
    WHERE nc_id = ?
  `;

  db.query(sql, [disposition, root_cause, corrective_action, remarks, closed_by, id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    res.json({ message: 'NCR disposition saved and NCR closed successfully' });
  });
};

// 7. Get FQC Summary Stats for reports
exports.getFinalQCStats = (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total_checked,
      SUM(CASE WHEN result = 'Approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN result = 'Rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN result = 'On Hold' THEN 1 ELSE 0 END) as hold_count,
      SUM(inspected_qty) as total_inspected_qty,
      SUM(accepted_qty) as total_accepted_qty,
      SUM(rejected_qty) as total_rejected_qty
    FROM final_qc_inspections
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    const stats = results[0] || {
      total_checked: 0,
      approved_count: 0,
      rejected_count: 0,
      hold_count: 0,
      total_inspected_qty: 0,
      total_accepted_qty: 0,
      total_rejected_qty: 0
    };
    
    // Calculate pass rate percentage
    const passRate = stats.total_checked > 0 
      ? Math.round((stats.approved_count / stats.total_checked) * 100) 
      : 100;
      
    res.json({ ...stats, passRate });
  });
};

// 8. Get Work Orders Pending Final QC
exports.getPendingFQC = (req, res) => {
  const sql = `
    SELECT 
      wo.wo_id,
      wo.wo_number,
      wo.item_id,
      wo.planned_qty,
      COALESCE(mpe_sum.produced_qty, 0) as produced_qty,
      COALESCE(fqc_sum.inspected_qty, 0) as inspected_qty,
      CASE 
        WHEN COALESCE(mpe_sum.produced_qty, 0) > 0 THEN (COALESCE(mpe_sum.produced_qty, 0) - COALESCE(fqc_sum.inspected_qty, 0))
        ELSE wo.planned_qty 
      END as pending_qty,
      i.item_code,
      i.item_name,
      i.unit,
      c.customer_name
    FROM work_orders wo
    JOIN items i ON wo.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    -- Left join to get sum of produced parts from moulding
    LEFT JOIN (
      SELECT jc.wo_id, SUM(mpe.good_parts) as produced_qty
      FROM moulding_production_entries mpe
      JOIN moulding_job_cards jc ON mpe.jc_id = jc.jc_id
      GROUP BY jc.wo_id
    ) mpe_sum ON wo.wo_id = mpe_sum.wo_id
    -- Left join to get sum of inspected parts from final QC
    LEFT JOIN (
      SELECT wo_id, SUM(inspected_qty) as inspected_qty
      FROM final_qc_inspections
      GROUP BY wo_id
    ) fqc_sum ON wo.wo_id = fqc_sum.wo_id
    WHERE COALESCE(mpe_sum.produced_qty, 0) > 0
      AND COALESCE(fqc_sum.inspected_qty, 0) < COALESCE(mpe_sum.produced_qty, 0)
      AND wo.status IN ('Released', 'In Progress', 'Completed')
    ORDER BY wo.wo_number DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error fetching pending FQC', error: err.message });
    res.json(results);
  });
};

