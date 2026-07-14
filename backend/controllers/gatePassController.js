const db = require('../config/db');

// Auto generate GP number
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
          const lastSerial = parseInt(last.split('/')[2]);
          nextNumber = lastSerial + 1;
        }
        const serial = String(nextNumber).padStart(5, '0');
        resolve(`GP/${year}/${serial}`);
      }
    );
  });
};

// Get all gate passes
exports.getAllGatePasses = (req, res) => {
  const sql = `
    SELECT gp.*, 
      s.supplier_name, 
      c.customer_name,
      u.name as created_by_name
    FROM gate_passes gp
    LEFT JOIN suppliers s ON gp.supplier_id = s.supplier_id
    LEFT JOIN customers c ON gp.customer_id = c.customer_id
    LEFT JOIN users u ON gp.created_by = u.user_id
    ORDER BY gp.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// Get single gate pass
exports.getGatePass = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT gp.*, 
      s.supplier_name,
      c.customer_name,
      u.name as created_by_name
    FROM gate_passes gp
    LEFT JOIN suppliers s ON gp.supplier_id = s.supplier_id
    LEFT JOIN customers c ON gp.customer_id = c.customer_id
    LEFT JOIN users u ON gp.created_by = u.user_id
    WHERE gp.gp_id = ?
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Gate pass not found' });

    const gp = results[0];

    db.query(
      'SELECT gpi.*, i.item_name, i.item_code FROM gate_pass_items gpi JOIN items i ON gpi.item_id = i.item_id WHERE gpi.gp_id = ?',
      [id],
      (err2, items) => {
        if (err2) return res.status(500).json({ message: 'Database error', error: err2 });

       db.query(
          `SELECT g.grn_id, g.grn_number, g.grn_date, g.status,
            (SELECT COUNT(*) FROM grn_items WHERE grn_id = g.grn_id) as item_lines
           FROM grn g WHERE g.gp_id = ?`,
          [id],
          (err3, grns) => {
            if (err3) return res.status(500).json({ message: 'Database error', error: err3 });
            res.json({ ...gp, items, linked_grns: grns });
          }
        );
      }
    );
  });
};
// Create gate pass
exports.createGatePass = async (req, res) => {
  const {
    gp_type, supplier_id, customer_id, vehicle_number,
    driver_name, dc_number, invoice_number, invoice_date, remarks, items
  } = req.body;

  const created_by = req.user.user_id;

  try {
    const gp_number = await generateGPNumber();

    db.query(
      `INSERT INTO gate_passes 
        (gp_number, gp_type, supplier_id, customer_id, vehicle_number, 
         driver_name, dc_number, invoice_number, invoice_date, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [gp_number, gp_type, supplier_id || null, customer_id || null,
       vehicle_number, driver_name, dc_number, invoice_number,
       invoice_date || null, remarks, created_by],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });

        const gp_id = result.insertId;

        if (items && items.length > 0) {
          const itemValues = items.map(item => [
            gp_id, item.item_id, item.expected_qty, item.unit || 'Nos'
          ]);
          db.query(
            'INSERT INTO gate_pass_items (gp_id, item_id, expected_qty, unit) VALUES ?',
            [itemValues],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Error adding items', error: err2 });
              res.status(201).json({ message: 'Gate Pass created successfully', gp_number, gp_id });
            }
          );
        } else {
          res.status(201).json({ message: 'Gate Pass created successfully', gp_number, gp_id });
        }
      }
    );
  } catch (err) {
    res.status(500).json({ message: 'Error generating GP number', error: err });
  }
};

// Update gate pass status
exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user_id = req.user.user_id;

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction start error', error: transactionErr });

    // 1. Get gate pass details
    db.query('SELECT gp_type, dc_number, customer_id, vehicle_number, driver_name FROM gate_passes WHERE gp_id = ?', [id], (err, gpResults) => {
      if (err) {
        return db.rollback(() => res.status(500).json({ message: 'Database error', error: err }));
      }
      if (gpResults.length === 0) {
        return db.rollback(() => res.status(404).json({ message: 'Gate pass not found' }));
      }

      const gp = gpResults[0];

      // 2. Update gate pass status
      db.query('UPDATE gate_passes SET status = ? WHERE gp_id = ?', [status, id], (errUpdate) => {
        if (errUpdate) {
          return db.rollback(() => res.status(500).json({ message: 'Database error', error: errUpdate }));
        }

        // 3. Hook for Outward gate pass closure
        if (gp.gp_type === 'Outward' && status === 'Closed' && gp.dc_number) {
          // Find matching dispatch order
          db.query('SELECT do_id, status FROM dispatch_orders WHERE do_number = ?', [gp.dc_number], (errDO, doResults) => {
            if (errDO || doResults.length === 0) {
              // Not a dispatch order gate pass or database error, just commit gate pass closure
              db.commit((errCommit) => {
                if (errCommit) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: errCommit }));
                return res.json({ message: 'Status updated successfully' });
              });
              return;
            }

            const dOrder = doResults[0];
            if (dOrder.status === 'Dispatched' || dOrder.status === 'Delivered') {
              // Already processed
              db.commit((errCommit) => {
                if (errCommit) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: errCommit }));
                return res.json({ message: 'Status updated successfully' });
              });
              return;
            }

            // Update dispatch order status to 'Dispatched'
            db.query("UPDATE dispatch_orders SET status = 'Dispatched' WHERE do_id = ?", [dOrder.do_id], (errSetStatus) => {
              if (errSetStatus) {
                return db.rollback(() => res.status(500).json({ message: 'Error updating dispatch order status', error: errSetStatus }));
              }

              // Get dispatch items to deduct stock
              db.query('SELECT item_id, qty FROM dispatch_items WHERE do_id = ?', [dOrder.do_id], async (errItems, dItems) => {
                if (errItems) {
                  return db.rollback(() => res.status(500).json({ message: 'Error fetching dispatch items', error: errItems }));
                }

                try {
                  const { updateStock } = require('../config/stockHelper');
                  for (const item of dItems) {
                    // Deduct stock in Finished Goods store (store_id = 3). Negative qty for outward movement.
                    await updateStock(db, item.item_id, 3, -parseFloat(item.qty), 'Dispatch', gp.dc_number, user_id);
                  }

                  db.commit((errCommit) => {
                    if (errCommit) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: errCommit }));
                    res.json({ message: 'Gate pass and associated Dispatch Order closed successfully. Stock updated.' });
                  });
                } catch (stockErr) {
                  db.rollback(() => res.status(500).json({ message: 'Error updating stock positions', error: stockErr.message }));
                }
              });
            });
          });
        } else {
          // General commit for other gate pass types / status values
          db.commit((errCommit) => {
            if (errCommit) return db.rollback(() => res.status(500).json({ message: 'Commit error', error: errCommit }));
            res.json({ message: 'Status updated successfully' });
          });
        }
      });
    });
  });
};

// Get suppliers for dropdown
exports.getSuppliers = (req, res) => {
  db.query('SELECT supplier_id, supplier_name, supplier_code FROM suppliers WHERE status = "Active"', (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
};

// Get items for dropdown
exports.getItems = (req, res) => {
  db.query('SELECT item_id, item_name, item_code, unit FROM items WHERE status = "Active"', (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
};