const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// Helper: Auto-generate FGR Number
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

// 1. Get Approved Final QC pending receipt
exports.getPendingQC = (req, res) => {
  const sql = `
    SELECT 
      qci.inspection_id,
      qci.inspection_number,
      qci.accepted_qty,
      qci.item_id,
      qci.label_number,
      fqc.fqc_number,
      i.item_code,
      i.item_name,
      i.unit,
      wo.wo_id,
      wo.wo_number,
      c.customer_name
    FROM qc_inspections qci
    JOIN items i ON qci.item_id = i.item_id
    JOIN final_qc_inspections fqc ON qci.inspection_id = fqc.inspection_id
    JOIN work_orders wo ON fqc.wo_id = wo.wo_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    WHERE qci.inspection_type = 'Final'
      AND qci.result = 'Accepted'
      AND qci.fgr_id IS NULL
    ORDER BY qci.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error retrieving pending Final QC', error: err.message });
    res.json(results);
  });
};

// 2. Get FG Receipts list
exports.getFGReceipts = (req, res) => {
  const sql = `
    SELECT 
      fgr.*,
      wo.wo_number,
      i.item_code,
      i.item_name,
      i.unit,
      c.customer_name,
      st.store_name,
      COALESCE(fqc.fqc_number, qci.inspection_number) as inspection_number
    FROM fg_receipts fgr
    JOIN work_orders wo ON fgr.wo_id = wo.wo_id
    JOIN items i ON fgr.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    LEFT JOIN stores st ON fgr.store_id = st.store_id
    LEFT JOIN qc_inspections qci ON qci.fgr_id = fgr.fgr_id
    LEFT JOIN final_qc_inspections fqc ON fqc.inspection_id = qci.inspection_id
    ORDER BY fgr.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error retrieving FG Receipts list', error: err.message });
    res.json(results);
  });
};

// 3. Get FGR stats
exports.getFGReceiptStats = (req, res) => {
  // Stats 1: Total FG Receipts count
  const countSql = 'SELECT COUNT(*) as total_receipts, COALESCE(SUM(received_qty), 0) as total_pieces FROM fg_receipts';
  
  // Stats 2: Pending FG Receipt count (approved FQC but fgr_id is null)
  const pendingSql = `
    SELECT COUNT(*) as pending_receipts 
    FROM qc_inspections 
    WHERE inspection_type = 'Final' 
      AND result = 'Accepted' 
      AND fgr_id IS NULL
  `;

  db.query(countSql, (err, counts) => {
    if (err) return res.status(500).json({ message: 'Error fetching FGR statistics', error: err.message });
    
    db.query(pendingSql, (err2, pendings) => {
      if (err2) return res.status(500).json({ message: 'Error fetching FGR statistics', error: err2.message });
      
      const stats = {
        total_receipts: counts[0]?.total_receipts || 0,
        pending_receipts: pendings[0]?.pending_receipts || 0,
        total_pieces: counts[0]?.total_pieces || 0
      };
      res.json(stats);
    });
  });
};

// 4. Get Finished Goods Stores
exports.getFGStores = (req, res) => {
  const sql = "SELECT * FROM stores WHERE store_type = 'Finished Good' AND status = 'Active'";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error retrieving FG stores', error: err.message });
    res.json(results);
  });
};

// 5. Create FG Receipt
exports.createFGReceipt = (req, res) => {
  const {
    inspection_id,
    wo_id,
    item_id,
    received_qty,
    store_id,
    receipt_date,
    remarks
  } = req.body;

  const created_by = req.user.user_id;

  if (!inspection_id || !wo_id || !item_id || !received_qty || !store_id || !receipt_date) {
    return res.status(400).json({ message: 'Missing required FG Receipt fields' });
  }

  db.beginTransaction(async (transactionErr) => {
    if (transactionErr) {
      return res.status(500).json({ message: 'Transaction start error', error: transactionErr.message });
    }

    try {
      // 1. Generate FGR number: FGR/YYYY/XXXXX
      const fgr_number = await generateFGRNumber();
      
      // 2. Fetch inspection label number to trace stock transaction reference
      const labelRes = await new Promise((resolve, reject) => {
        db.query('SELECT label_number FROM qc_inspections WHERE inspection_id = ?', [inspection_id], (errL, results) => {
          if (errL) return reject(errL);
          resolve(results[0]?.label_number || `FGL/TEMP/${inspection_id}`);
        });
      });

      // 3. Insert FGR record
      const insertSql = `
        INSERT INTO fg_receipts 
          (fgr_number, wo_id, item_id, received_qty, store_id, receipt_date, qc_status, created_by, bin, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Passed', ?, 'FG Area', 'Available', NOW())
      `;

      const fgr_id = await new Promise((resolve, reject) => {
        db.query(
          insertSql,
          [fgr_number, wo_id, item_id, received_qty, store_id, receipt_date, created_by],
          (err, insertRes) => {
            if (err) return reject(err);
            resolve(insertRes.insertId);
          }
        );
      });

      // 4. Update qc_inspections setting fgr_id to link FQC batch to FGR
      await new Promise((resolve, reject) => {
        db.query(
          'UPDATE qc_inspections SET fgr_id = ? WHERE inspection_id = ?',
          [fgr_id, inspection_id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // 5. Update produced quantity in work_orders
      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE work_orders 
           SET produced_qty = produced_qty + ? 
           WHERE wo_id = ?`,
          [received_qty, wo_id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // 6. Increase stock & write stock ledger
      await updateStock(db, item_id, store_id, received_qty, 'FG Receipt', fgr_number, created_by);

      db.commit((commitErr) => {
        if (commitErr) {
          return db.rollback(() => {
            res.status(500).json({ message: 'Commit error', error: commitErr.message });
          });
        }
        res.status(201).json({
          message: 'FG Receipt created successfully',
          fgr_number,
          fgr_id
        });
      });

    } catch (innerErr) {
      db.rollback(() => {
        res.status(500).json({ message: 'Failed to complete FG Receipt', error: innerErr.message });
      });
    }
  });
};

// 6. Get FG Receipt details by ID
exports.getFGReceiptById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      fgr.*,
      wo.wo_number,
      i.item_code,
      i.item_name,
      i.unit,
      c.customer_name,
      st.store_name,
      u.name as creator_name,
      COALESCE(fqc.fqc_number, qci.inspection_number) as inspection_number
    FROM fg_receipts fgr
    JOIN work_orders wo ON fgr.wo_id = wo.wo_id
    JOIN items i ON fgr.item_id = i.item_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    LEFT JOIN stores st ON fgr.store_id = st.store_id
    LEFT JOIN users u ON fgr.created_by = u.user_id
    LEFT JOIN qc_inspections qci ON qci.fgr_id = fgr.fgr_id
    LEFT JOIN final_qc_inspections fqc ON fqc.inspection_id = qci.inspection_id
    WHERE fgr.fgr_id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'FG Receipt not found' });
    res.json(results[0]);
  });
};
