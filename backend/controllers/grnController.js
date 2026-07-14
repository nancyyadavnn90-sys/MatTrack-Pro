const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// Auto generate GRN number
const generateGRNNumber = () => {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT grn_number FROM grn ORDER BY grn_id DESC LIMIT 1',
      (err, results) => {
        if (err) return reject(err);
        let nextNumber = 1;
        if (results.length > 0) {
          const last = results[0].grn_number;
          const lastSerial = parseInt(last.split('/')[2]);
          nextNumber = lastSerial + 1;
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`GRN/${year}/${serial}`);
      }
    );
  });
};

// Get all GRNs
exports.getAllGRNs = (req, res) => {
  const sql = `
    SELECT g.*, 
      s.supplier_name,
      gp.gp_number,
      st.store_name,
      u.name as created_by_name
    FROM grn g
    LEFT JOIN suppliers s ON g.supplier_id = s.supplier_id
    LEFT JOIN gate_passes gp ON g.gp_id = gp.gp_id
    LEFT JOIN stores st ON g.store_id = st.store_id
    LEFT JOIN users u ON g.created_by = u.user_id
    ORDER BY g.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// Get single GRN with items
exports.getGRN = (req, res) => {
  const { id } = req.params;
  db.query(
    `SELECT g.*, s.supplier_name, gp.gp_number, st.store_name
     FROM grn g
     LEFT JOIN suppliers s ON g.supplier_id = s.supplier_id
     LEFT JOIN gate_passes gp ON g.gp_id = gp.gp_id
     LEFT JOIN stores st ON g.store_id = st.store_id
     WHERE g.grn_id = ?`,
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err });
      if (results.length === 0) return res.status(404).json({ message: 'GRN not found' });

      db.query(
        `SELECT gi.*, i.item_name, i.item_code
         FROM grn_items gi
         JOIN items i ON gi.item_id = i.item_id
         WHERE gi.grn_id = ?`,
        [id],
        (err2, items) => {
          if (err2) return res.status(500).json({ message: 'Database error', error: err2 });
          res.json({ ...results[0], items });
        }
      );
    }
  );
};

// Get open gate passes for dropdown
exports.getOpenGatePasses = (req, res) => {
  const sql = `
    SELECT gp.gp_id, gp.gp_number, gp.supplier_id,
      s.supplier_name, gp.invoice_number
    FROM gate_passes gp
    LEFT JOIN suppliers s ON gp.supplier_id = s.supplier_id
    WHERE gp.status = 'Open' AND gp.gp_type = 'Inward'
    ORDER BY gp.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
};

// Get gate pass items for a specific GP
exports.getGatePassItems = (req, res) => {
  const { gp_id } = req.params;
  db.query(
    `SELECT gpi.*, i.item_name, i.item_code, i.unit
     FROM gate_pass_items gpi
     JOIN items i ON gpi.item_id = i.item_id
     WHERE gpi.gp_id = ?`,
    [gp_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// Get stores for dropdown
exports.getStores = (req, res) => {
  db.query(
    'SELECT store_id, store_name, store_type FROM stores WHERE status = "Active"',
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// Create GRN
exports.createGRN = async (req, res) => {
  const {
    gp_id, supplier_id, grn_date, invoice_number,
    invoice_value, store_id, remarks, items, qc_required
  } = req.body;

  const created_by = req.user.user_id;

  try {
    const grn_number = await generateGRNNumber();

   const grnStatus = qc_required === 'No' ? 'Completed' : 'QC Pending';

    db.query(
      `INSERT INTO grn 
        (grn_number, gp_id, supplier_id, grn_date, invoice_number,
         invoice_value, store_id, remarks, created_by, qc_required, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [grn_number, gp_id, supplier_id, grn_date, invoice_number,
       invoice_value || 0, store_id, remarks, created_by, qc_required || 'Yes', grnStatus],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });

        const grn_id = result.insertId;

        const itemStatus = qc_required === 'No' ? 'Available' : 'QC Pending';

        if (items && items.length > 0) {
          const itemValues = items.map(item => [
            grn_id,
            item.item_id,
            item.ordered_qty || 0,
            item.received_qty,
            item.accepted_qty || item.received_qty,
            item.rejected_qty || 0,
            item.unit || 'Kg',
            item.batch_number || null,
            item.expiry_date || null,
            itemStatus
          ]);

          db.query(
            `INSERT INTO grn_items 
              (grn_id, item_id, ordered_qty, received_qty, accepted_qty, 
               rejected_qty, unit, batch_number, expiry_date, status) 
             VALUES ?`,
            [itemValues],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Error adding items', error: err2 });

              // Update stock levels and ledger
              const stockPromises = items.map(item => {
                const qty = parseFloat(item.accepted_qty || item.received_qty || 0);
                if (qty <= 0) return Promise.resolve();
                return updateStock(db, item.item_id, store_id, qty, 'GRN', grn_number, created_by);
              });

              Promise.all(stockPromises)
                .then(() => {
                  // Update gate pass status to GRN Created
                  db.query(
                    'UPDATE gate_passes SET status = "GRN Created" WHERE gp_id = ?',
                    [gp_id],
                    (err3) => {
                      if (err3) console.error('Error updating GP status:', err3);
                    }
                  );
                  res.status(201).json({ message: 'GRN created successfully', grn_number, grn_id });
                })
                .catch(stockErr => {
                  console.error('Stock update failed during GRN creation:', stockErr);
                  res.status(201).json({ message: 'GRN created but stock update failed', grn_number, grn_id });
                });
            }
          );
        } else {
          res.status(201).json({ message: 'GRN created successfully', grn_number, grn_id });
        }
      }
    );
  } catch (err) {
    res.status(500).json({ message: 'Error generating GRN number', error: err });
  }
};

// Update GRN status
exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  db.query(
    'UPDATE grn SET status = ? WHERE grn_id = ?',
    [status, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err });
      res.json({ message: 'Status updated successfully' });
    }
  );
};