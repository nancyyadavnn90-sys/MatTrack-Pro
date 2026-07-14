const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// Helper: Auto-generate Inspection Number
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
          const lastSerial = parseInt(last.split('/')[2] || '0');
          nextNumber = lastSerial + 1;
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
          const lastSerial = parseInt(last.split('/')[2] || '0');
          nextNumber = lastSerial + 1;
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`NC/${year}/${serial}`);
      }
    );
  });
};

// 1. Get QC Inspection Queue (pending items)
exports.getQCQueue = (req, res) => {
  // Query pending Inward (grn_items where status = 'QC Pending')
  const inwardQuery = `
    SELECT 
      gi.grn_item_id as reference_id,
      gi.grn_id,
      gi.item_id,
      gi.received_qty as quantity,
      gi.unit,
      gi.batch_number,
      gi.expiry_date,
      gi.bin,
      gi.status,
      i.item_code,
      i.item_name,
      i.unit,
      g.grn_number,
      g.grn_date,
      g.invoice_number,
      g.invoice_value,
      g.remarks as grn_remarks,
      g.store_id,
      s.supplier_name,
      gp.gp_number,
      gp.invoice_date,
      gp.invoice_number as gp_invoice_number,
      gp.dc_number
    FROM grn_items gi
    JOIN grn g ON gi.grn_id = g.grn_id
    JOIN items i ON gi.item_id = i.item_id
    LEFT JOIN suppliers s ON g.supplier_id = s.supplier_id
    LEFT JOIN gate_passes gp ON g.gp_id = gp.gp_id
    WHERE g.qc_required = 'Yes' AND gi.status = 'QC Pending'
  `;

  // Query pending In-Process (batches where status = 'QC Hold')
  const inProcessQuery = `
    SELECT 
      b.batch_id as reference_id,
      b.batch_number,
      b.quantity,
      b.item_id,
      b.status,
      i.item_code,
      i.item_name,
      i.unit,
      wo.wo_number,
      m.machine_name
    FROM batches b
    JOIN items i ON b.item_id = i.item_id
    LEFT JOIN work_orders wo ON b.wo_id = wo.wo_id
    LEFT JOIN machines m ON b.machine_id = m.machine_id
    WHERE b.status = 'QC Hold'
  `;

  // Query pending Final (fg_receipts where qc_status = 'Pending')
  const finalQuery = `
    SELECT 
      fgr.fgr_id as reference_id,
      fgr.fgr_number,
      fgr.received_qty as quantity,
      fgr.item_id,
      fgr.qc_status,
      fgr.receipt_date,
      fgr.store_id,
      i.item_code,
      i.item_name,
      i.unit,
      wo.wo_number,
      st.store_name
    FROM fg_receipts fgr
    JOIN items i ON fgr.item_id = i.item_id
    LEFT JOIN work_orders wo ON fgr.wo_id = wo.wo_id
    LEFT JOIN stores st ON fgr.store_id = st.store_id
    WHERE fgr.qc_status = 'Pending'
  `;

  db.query(inwardQuery, (err, inward) => {
    if (err) return res.status(500).json({ message: 'Error fetching inward QC queue', error: err });
    
    db.query(inProcessQuery, (err2, inprocess) => {
      if (err2) return res.status(500).json({ message: 'Error fetching in-process QC queue', error: err2 });
      
      db.query(finalQuery, (err3, final) => {
        if (err3) return res.status(500).json({ message: 'Error fetching final QC queue', error: err3 });
        
        res.json({ inward, inprocess, final });
      });
    });
  });
};

// 2. Get Passed Inspections
exports.getPassedInspections = (req, res) => {
  const sql = `
    SELECT 
      qci.*,
      i.item_code,
      i.item_name,
      i.unit,
      u.name as inspector_name,
      g.grn_number,
      COALESCE(gi.batch_number, b.batch_number) as batch_number
    FROM qc_inspections qci
    JOIN items i ON qci.item_id = i.item_id
    LEFT JOIN users u ON qci.inspected_by = u.user_id
    LEFT JOIN grn g ON qci.grn_id = g.grn_id
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.grn_item_id
    LEFT JOIN batches b ON qci.batch_id = b.batch_id
    WHERE qci.result IN ('Accepted', 'Partially Accepted')
    ORDER BY qci.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// 3. Get Non-Conformances (NCRs)
exports.getNonConformances = (req, res) => {
  const sql = `
    SELECT 
      nc.*,
      qci.inspection_number,
      qci.grn_id,
      qci.grn_item_id,
      qci.label_number,
      i.item_code,
      i.item_name,
      gi.batch_number,
      g.grn_number,
      u.name as inspector_name
    FROM non_conformances nc
    JOIN qc_inspections qci ON nc.inspection_id = qci.inspection_id
    JOIN items i ON qci.item_id = i.item_id
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.grn_item_id
    LEFT JOIN grn g ON qci.grn_id = g.grn_id
    LEFT JOIN users u ON nc.raised_by = u.user_id
    ORDER BY nc.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// 4. Get NC Details by ID
exports.getNCDetail = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      nc.*,
      qci.inspection_number,
      qci.grn_id,
      qci.grn_item_id,
      qci.label_number,
      qci.accepted_qty,
      i.item_code,
      i.item_name,
      i.unit,
      gi.batch_number,
      g.grn_number,
      s.supplier_name,
      u.name as inspector_name
    FROM non_conformances nc
    JOIN qc_inspections qci ON nc.inspection_id = qci.inspection_id
    JOIN items i ON qci.item_id = i.item_id
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.grn_item_id
    LEFT JOIN grn g ON qci.grn_id = g.grn_id
    LEFT JOIN suppliers s ON g.supplier_id = s.supplier_id
    LEFT JOIN users u ON nc.raised_by = u.user_id
    WHERE nc.nc_id = ?
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'NC Report not found' });
    res.json(results[0]);
  });
};

// 5. Get single Inspection detail
exports.getInspection = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      qci.*,
      i.item_code,
      i.item_name,
      i.unit,
      i.description as item_desc,
      g.grn_number,
      g.grn_date,
      g.invoice_number,
      g.invoice_value,
      g.store_id,
      st.store_name,
      s.supplier_name,
      gp.gp_number,
      gp.dc_number,
      gp.invoice_date,
      u.name as inspector_name,
      COALESCE(gi.batch_number, b.batch_number) as batch_number,
      COALESCE(gi.mfg_date, b.created_at) as mfg_date,
      COALESCE(gi.expiry_date, b.created_at) as expiry_date
    FROM qc_inspections qci
    JOIN items i ON qci.item_id = i.item_id
    LEFT JOIN grn g ON qci.grn_id = g.grn_id
    LEFT JOIN stores st ON g.store_id = st.store_id
    LEFT JOIN suppliers s ON g.supplier_id = s.supplier_id
    LEFT JOIN gate_passes gp ON g.gp_id = gp.gp_id
    LEFT JOIN users u ON qci.inspected_by = u.user_id
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.grn_item_id
    LEFT JOIN batches b ON qci.batch_id = b.batch_id
    WHERE qci.inspection_id = ?
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Inspection not found' });
    res.json(results[0]);
  });
};

// 6. Submit QC Inspection Form
exports.createInspection = async (req, res) => {
  const {
    inspection_type,
    reference_id, // grn_item_id or batch_id or fgr_id
    item_id,
    inspected_qty,
    accepted_qty,
    rejected_qty,
    remarks,
    defect_type,
    defect_description,
    severity,
    batch_number,
    mfg_date,
    expiry_date
  } = req.body;

  const inspected_by = req.user.user_id;

  try {
    const inspection_number = await generateInspectionNumber();
    
    // Result determination
    let result = 'Pending';
    const acc = parseFloat(accepted_qty || 0);
    const rej = parseFloat(rejected_qty || 0);
    
    if (rej === 0) result = 'Accepted';
    else if (acc === 0) result = 'Rejected';
    else result = 'Partially Accepted';

    // Insert inspection report
    let grn_id = null;
    let grn_item_id = null;
    let batch_id = null;
    let fgr_id = null;
    let label_number = null;

    if (inspection_type === 'Inward') {
      grn_item_id = reference_id;
      label_number = `MAT/2627/${String(grn_item_id).padStart(5, '0')}`;
    } else if (inspection_type === 'In-Process') {
      batch_id = reference_id;
      label_number = `WIP/2627/${String(batch_id).padStart(5, '0')}`;
    } else if (inspection_type === 'Final') {
      fgr_id = reference_id;
      label_number = `FGL/2627/${String(fgr_id).padStart(5, '0')}`;
    }

    // First fetch parent GRN ID if Inward
    const getGrnId = () => {
      return new Promise((resolve) => {
        if (inspection_type === 'Inward') {
          db.query('SELECT grn_id FROM grn_items WHERE grn_item_id = ?', [grn_item_id], (e, r) => {
            if (!e && r.length > 0) grn_id = r[0].grn_id;
            resolve();
          });
        } else {
          resolve();
        }
      });
    };

    await getGrnId();

    const insertSql = `
      INSERT INTO qc_inspections 
        (inspection_number, inspection_type, grn_id, grn_item_id, batch_id, fgr_id, 
         item_id, inspected_qty, accepted_qty, rejected_qty, result, inspected_by, inspection_date, remarks, label_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `;

    db.query(
      insertSql,
      [inspection_number, inspection_type, grn_id, grn_item_id, batch_id, fgr_id,
       item_id, inspected_qty, accepted_qty, rejected_qty, result, inspected_by, remarks, label_number],
      async (err, inspectResult) => {
        if (err) return res.status(500).json({ message: 'Failed to save inspection', error: err });
        
        const inspection_id = inspectResult.insertId;

        // Perform Inventory split / WIP update / FG update
        if (inspection_type === 'Inward') {
          // Fetch parent GRN to get the target store
          db.query(
            'SELECT gi.*, g.store_id, g.grn_number FROM grn_items gi JOIN grn g ON gi.grn_id = g.grn_id WHERE gi.grn_item_id = ?',
            [grn_item_id],
            async (err2, results) => {
              if (err2 || results.length === 0) return res.status(500).json({ message: 'Error retrieving label details' });
              
              const grnItem = results[0];
              const store_id = grnItem.store_id;

              // 1. Update original label: reduce accepted_qty, set status, and save verified fields
              const finalBatch = batch_number || grnItem.batch_number;
              const finalMfg = mfg_date || grnItem.mfg_date;
              const finalExpiry = expiry_date || grnItem.expiry_date;

              db.query(
                `UPDATE grn_items 
                 SET accepted_qty = ?, status = 'Available', batch_number = ?, mfg_date = ?, expiry_date = ? 
                 WHERE grn_item_id = ?`,
                [acc, finalBatch, finalMfg, finalExpiry, grn_item_id]
              );

              // 2. Adjust stock ledger: if some rejected, remove them from general stock position
              if (rej > 0) {
                await updateStock(db, item_id, store_id, -rej, 'Adjustment', `QC Reject - ${inspection_number}`, inspected_by);

                // 3. Split rejected amount into a new label with status 'Quarantined' and bin 'Quarantine Area'
                db.query(
                  `INSERT INTO grn_items 
                    (grn_id, item_id, ordered_qty, received_qty, accepted_qty, rejected_qty, unit, batch_number, mfg_date, expiry_date, bin, status)
                   VALUES (?, ?, 0, ?, ?, 0, ?, ?, ?, ?, 'Quarantine Area', 'Quarantined')`,
                  [grnItem.grn_id, item_id, rej, rej, grnItem.unit, finalBatch, finalMfg, finalExpiry],
                  async (err3, splitRes) => {
                    if (err3) console.error('Failed to insert quarantined label:', err3);
                  }
                );

                // 4. Raise Non-Conformance Report
                const nc_number = await generateNCNumber();
                db.query(
                  `INSERT INTO non_conformances 
                    (nc_number, inspection_id, defect_type, defect_description, qty_affected, severity, status, raised_by)
                   VALUES (?, ?, ?, ?, ?, ?, 'Open', ?)`,
                  [nc_number, inspection_id, defect_type || 'Defect', defect_description || remarks, rej, severity || 'Minor', inspected_by]
                );
              }
              
              // If there are no other QC Pending items in this GRN, close/complete the GRN status
              db.query(
                `SELECT count(*) as pending_count FROM grn_items WHERE grn_id = ? AND status = 'QC Pending'`,
                [grnItem.grn_id],
                (err4, counts) => {
                  if (!err4 && counts[0].pending_count === 0) {
                    db.query('UPDATE grn SET status = \'Completed\' WHERE grn_id = ?', [grnItem.grn_id]);
                  }
                }
              );

              res.status(201).json({ message: 'Inspection completed successfully', inspection_number, inspection_id });
            }
          );
        } else if (inspection_type === 'In-Process') {
          // WIP QC Hold batch is approved
          const nextStatus = rej > 0 ? 'QC Hold' : 'Completed';
          db.query(
            'UPDATE batches SET status = ? WHERE batch_id = ?',
            [nextStatus, batch_id],
            async (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to update WIP batch' });

              if (rej > 0) {
                // Raise NC
                const nc_number = await generateNCNumber();
                db.query(
                  `INSERT INTO non_conformances 
                    (nc_number, inspection_id, defect_type, defect_description, qty_affected, severity, status, raised_by)
                   VALUES (?, ?, ?, ?, ?, ?, 'Open', ?)`,
                  [nc_number, inspection_id, defect_type || 'Defect', defect_description || remarks, rej, severity || 'Minor', inspected_by]
                );
              }
              res.status(201).json({ message: 'Inspection completed successfully', inspection_number, inspection_id });
            }
          );
        } else if (inspection_type === 'Final') {
          // Final FG inspection
          const fgStatus = rej > 0 ? 'Failed' : 'Passed';
          const labelStatus = rej > 0 ? 'Quarantined' : 'Available';

          db.query(
            'UPDATE fg_receipts SET qc_status = ?, status = ? WHERE fgr_id = ?',
            [fgStatus, labelStatus, fgr_id],
            async (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to update FG receipt' });

              // If Passed, add to Finished Goods stock (Store ID is retrieved from receipt)
              if (fgStatus === 'Passed') {
                db.query('SELECT store_id FROM fg_receipts WHERE fgr_id = ?', [fgr_id], async (err3, rStore) => {
                  if (!err3 && rStore.length > 0) {
                    const fgStore = rStore[0].store_id;
                    await updateStock(db, item_id, fgStore, acc, 'FG Receipt', label_number, inspected_by);
                  }
                });
              } else {
                // Raise NC for failed Finished Goods
                const nc_number = await generateNCNumber();
                db.query(
                  `INSERT INTO non_conformances 
                    (nc_number, inspection_id, defect_type, defect_description, qty_affected, severity, status, raised_by)
                   VALUES (?, ?, ?, ?, ?, ?, 'Open', ?)`,
                  [nc_number, inspection_id, defect_type || 'Defect', defect_description || remarks, rej, severity || 'Minor', inspected_by]
                );
              }
              res.status(201).json({ message: 'Inspection completed successfully', inspection_number, inspection_id });
            }
          );
        }
      }
    );
  } catch (err) {
    res.status(500).json({ message: 'Error generating inspection details', error: err.message });
  }
};

// 7. Disposition Decision / Close NC Report
exports.closeNonConformance = async (req, res) => {
  const { id } = req.params; // nc_id
  const { disposition, root_cause, corrective_action, remarks } = req.body;
  const closed_by = req.user.user_id;

  if (!disposition) {
    return res.status(400).json({ message: 'Disposition decision is required' });
  }

  try {
    // Fetch NC and original inspection details
    db.query(
      `SELECT nc.*, qci.item_id, qci.grn_item_id, qci.grn_id, qci.label_number, g.store_id 
       FROM non_conformances nc
       JOIN qc_inspections qci ON nc.inspection_id = qci.inspection_id
       LEFT JOIN grn g ON qci.grn_id = g.grn_id
       WHERE nc.nc_id = ?`,
      [id],
      async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });
        if (results.length === 0) return res.status(404).json({ message: 'NC Report not found' });

        const nc = results[0];
        
        if (nc.status === 'Closed') {
          return res.status(400).json({ message: 'This NC report is already closed' });
        }

        const qty = parseFloat(nc.qty_affected);
        const item_id = nc.item_id;
        const store_id = nc.store_id;

        // Perform inventory actions based on disposition
        if (disposition === 'Use As-Is') {
          // 1. Restore stock to store
          if (store_id) {
            await updateStock(db, item_id, store_id, qty, 'Adjustment', `NC Close (Use As-Is) - ${nc.nc_number}`, closed_by);
          }
          // 2. Find and update quarantined split label status to 'Available'
          db.query(
            'UPDATE grn_items SET status = \'Available\' WHERE grn_id = ? AND item_id = ? AND status = \'Quarantined\' LIMIT 1',
            [nc.grn_id, item_id]
          );
        } else if (disposition === 'Rework') {
          // Label status changes to 'Rework' (represented as QC Pending or custom status)
          db.query(
            'UPDATE grn_items SET status = \'Rework\' WHERE grn_id = ? AND item_id = ? AND status = \'Quarantined\' LIMIT 1',
            [nc.grn_id, item_id]
          );
        } else if (disposition === 'Reject') {
          // Quarantined split remains Quarantined
          db.query(
            'UPDATE grn_items SET status = \'Quarantined\', bin = \'Quarantine Area\' WHERE grn_id = ? AND item_id = ? AND status = \'Quarantined\' LIMIT 1',
            [nc.grn_id, item_id]
          );
        } else if (disposition === 'Return to Supplier') {
          // Delete split or mark status as 'Returned'
          db.query(
            'UPDATE grn_items SET status = \'Returned\' WHERE grn_id = ? AND item_id = ? AND status = \'Quarantined\' LIMIT 1',
            [nc.grn_id, item_id]
          );
        }

        // Close the NC Report
        const updateNcSql = `
          UPDATE non_conformances 
          SET status = 'Closed', disposition = ?, root_cause = ?, corrective_action = ?, remarks = ?, closed_by = ?, closed_at = NOW() 
          WHERE nc_id = ?
        `;

        db.query(
          updateNcSql,
          [disposition, root_cause, corrective_action, remarks, closed_by, id],
          (err2) => {
            if (err2) return res.status(500).json({ message: 'Failed to close NC report', error: err2 });
            res.json({ message: 'Non-conformance report closed successfully' });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to process NC closure', error: err.message });
  }
};

exports.getInspectionByLabel = (req, res) => {
  const { labelNumber } = req.params;
  const sql = `
    SELECT 
      qci.*,
      i.item_code,
      i.item_name,
      i.unit,
      i.description as item_desc,
      g.grn_number,
      g.grn_date,
      g.invoice_number,
      g.invoice_value,
      g.store_id,
      st.store_name,
      s.supplier_name,
      gp.gp_number,
      gp.dc_number,
      gp.invoice_date,
      u.name as inspector_name,
      COALESCE(gi.batch_number, b.batch_number) as batch_number,
      COALESCE(gi.mfg_date, b.created_at) as mfg_date,
      COALESCE(gi.expiry_date, b.created_at) as expiry_date
    FROM qc_inspections qci
    JOIN items i ON qci.item_id = i.item_id
    LEFT JOIN grn g ON qci.grn_id = g.grn_id
    LEFT JOIN stores st ON g.store_id = st.store_id
    LEFT JOIN suppliers s ON g.supplier_id = s.supplier_id
    LEFT JOIN gate_passes gp ON g.gp_id = gp.gp_id
    LEFT JOIN users u ON qci.inspected_by = u.user_id
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.grn_item_id
    LEFT JOIN batches b ON qci.batch_id = b.batch_id
    WHERE qci.label_number = ? OR qci.inspection_number = ?
  `;
  db.query(sql, [labelNumber, labelNumber], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Inspection not found' });
    res.json(results[0]);
  });
};
