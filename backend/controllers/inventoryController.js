const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// 1. Get stock positions (summarized)
exports.getStockPositions = (req, res) => {
  const { store_id, category, search } = req.query;
  
  let sql = `
    SELECT 
      sp.stock_id,
      sp.item_id,
      sp.store_id,
      sp.current_qty,
      sp.last_updated,
      i.item_code,
      i.item_name,
      i.category,
      i.unit,
      i.reorder_level,
      st.store_name,
      st.store_type,
      st.location as store_location
    FROM stock_positions sp
    JOIN items i ON sp.item_id = i.item_id
    JOIN stores st ON sp.store_id = st.store_id
    WHERE 1=1
  `;
  const params = [];
  
  if (store_id) {
    sql += ' AND sp.store_id = ?';
    params.push(store_id);
  }
  if (category) {
    sql += ' AND i.category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (i.item_name LIKE ? OR i.item_code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  sql += ' ORDER BY i.item_code ASC';
  
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// 2. Get stock ledger
exports.getStockLedger = (req, res) => {
  const { date_from, date_to, transaction_type, item_code } = req.query;
  
  let sql = `
    SELECT 
      sl.*,
      i.item_code,
      i.item_name,
      i.unit,
      st.store_name,
      u.name as user_name
    FROM stock_ledger sl
    JOIN items i ON sl.item_id = i.item_id
    JOIN stores st ON sl.store_id = st.store_id
    JOIN users u ON sl.created_by = u.user_id
    WHERE 1=1
  `;
  const params = [];
  
  if (date_from) {
    sql += ' AND sl.transaction_date >= ?';
    params.push(`${date_from} 00:00:00`);
  }
  if (date_to) {
    sql += ' AND sl.transaction_date <= ?';
    params.push(`${date_to} 23:59:59`);
  }
  if (transaction_type && transaction_type !== 'All Types' && transaction_type !== 'All') {
    sql += ' AND sl.transaction_type = ?';
    params.push(transaction_type);
  }
  if (item_code) {
    sql += ' AND i.item_code LIKE ?';
    params.push(`%${item_code}%`);
  }
  
  sql += ' ORDER BY sl.transaction_date DESC';
  
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// 3. Get low stock alerts
exports.getLowStockAlerts = (req, res) => {
  const sql = `
    SELECT 
      i.item_id,
      i.item_code,
      i.item_name,
      i.category,
      i.unit,
      i.reorder_level,
      COALESCE(SUM(sp.current_qty), 0) as total_stock
    FROM items i
    LEFT JOIN stock_positions sp ON i.item_id = sp.item_id
    WHERE i.status = 'Active'
    GROUP BY i.item_id
    HAVING total_stock < i.reorder_level OR total_stock = 0
    ORDER BY i.item_code ASC
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// 4. Get expiry alerts (expiring within 30 days)
exports.getExpiryAlerts = (req, res) => {
  const sql = `
    SELECT 
      gi.grn_item_id,
      CONCAT('MAT/2627/', LPAD(gi.grn_item_id, 5, '0')) as label_number,
      gi.item_id,
      i.item_code,
      i.item_name,
      gi.batch_number,
      gi.expiry_date,
      gi.accepted_qty as quantity,
      gi.unit,
      gi.bin,
      gi.status,
      st.store_name,
      DATEDIFF(gi.expiry_date, NOW()) as days_to_expiry
    FROM grn_items gi
    JOIN grn g ON gi.grn_id = g.grn_id
    JOIN items i ON gi.item_id = i.item_id
    LEFT JOIN stores st ON g.store_id = st.store_id
    WHERE gi.expiry_date IS NOT NULL 
      AND gi.status = 'Available'
      AND gi.expiry_date <= DATE_ADD(NOW(), INTERVAL 30 DAY)
    ORDER BY gi.expiry_date ASC
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// 5. Get labels (unified raw materials and finished goods list for query/scan)
exports.getLabels = (req, res) => {
  const { search, store_id, bin, batch_no, status } = req.query;
  
  let sql = `
    SELECT * FROM (
      SELECT 
        CONCAT('MAT/2627/', LPAD(gi.grn_item_id, 5, '0')) as label_number,
        'Raw Material' as label_type,
        gi.grn_item_id as reference_id,
        gi.item_id,
        i.item_code,
        i.item_name,
        i.unit,
        gi.accepted_qty as quantity,
        gi.batch_number,
        gi.expiry_date,
        g.store_id,
        st.store_name,
        gi.bin,
        gi.status,
        gi.expiry_date as expiry_or_mfg_date
      FROM grn_items gi
      JOIN grn g ON gi.grn_id = g.grn_id
      JOIN items i ON gi.item_id = i.item_id
      LEFT JOIN stores st ON g.store_id = st.store_id

      UNION ALL

      SELECT 
        CONCAT('FGL/2627/', LPAD(fgr.fgr_id, 5, '0')) as label_number,
        'Finished Good' as label_type,
        fgr.fgr_id as reference_id,
        fgr.item_id,
        i.item_code,
        i.item_name,
        i.unit,
        fgr.received_qty as quantity,
        '' as batch_number,
        NULL as expiry_date,
        fgr.store_id,
        st.store_name,
        fgr.bin,
        fgr.status,
        NULL as expiry_or_mfg_date
      FROM fg_receipts fgr
      JOIN items i ON fgr.item_id = i.item_id
      LEFT JOIN stores st ON fgr.store_id = st.store_id
    ) AS unified_stock WHERE 1=1
  `;
  const params = [];
  
  if (search) {
    sql += ' AND (label_number = ? OR item_code LIKE ? OR item_name LIKE ?)';
    params.push(search, `%${search}%`, `%${search}%`);
  }
  if (store_id) {
    sql += ' AND store_id = ?';
    params.push(store_id);
  }
  if (bin) {
    sql += ' AND bin LIKE ?';
    params.push(`%${bin}%`);
  }
  if (batch_no) {
    sql += ' AND batch_number LIKE ?';
    params.push(`%${batch_no}%`);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY label_number DESC';
  
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
};

// 6. Put-away (Assign Bin)
exports.putAway = async (req, res) => {
  const { label_number, store_id, bin } = req.body;
  const created_by = req.user.user_id;
  
  if (!label_number || !store_id || !bin) {
    return res.status(400).json({ message: 'Label, store, and bin are required' });
  }
  
  try {
    const parts = label_number.split('/');
    const prefix = parts[0];
    const id = parseInt(parts[2]);
    
    if (prefix === 'MAT') {
      db.query(
        `SELECT gi.*, g.store_id as current_store_id, g.grn_number FROM grn_items gi 
         JOIN grn g ON gi.grn_id = g.grn_id 
         WHERE gi.grn_item_id = ?`,
        [id],
        async (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err });
          if (results.length === 0) return res.status(404).json({ message: 'Label not found' });
          
          const item = results[0];
          const current_store_id = item.current_store_id;
          
          // If store changes, transfer the stock position
          if (current_store_id !== parseInt(store_id)) {
            await updateStock(db, item.item_id, current_store_id, -item.accepted_qty, 'Transfer', label_number, created_by);
            await updateStock(db, item.item_id, store_id, item.accepted_qty, 'Transfer', label_number, created_by);
            db.query('UPDATE grn SET store_id = ? WHERE grn_id = ?', [store_id, item.grn_id]);
          }
          
          // Update bin and status
          db.query(
            'UPDATE grn_items SET bin = ?, status = \'Available\' WHERE grn_item_id = ?',
            [bin, id],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to assign bin', error: err2 });
              
              // Also log ledger transaction for Put-Away if it wasn't assigned before
              if (!item.bin) {
                db.query(
                  `INSERT INTO stock_ledger 
                    (item_id, store_id, transaction_type, reference_number, qty_in, qty_out, balance, created_by)
                   VALUES (?, ?, 'Transfer', ?, 0, 0, ?, ?)`,
                  [item.item_id, store_id, `Put Away - Bin ${bin}`, item.accepted_qty, created_by]
                );
              }
              
              res.json({ message: 'Put-Away completed successfully' });
            }
          );
        }
      );
    } else if (prefix === 'FGL') {
      db.query(
        'SELECT * FROM fg_receipts WHERE fgr_id = ?',
        [id],
        async (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err });
          if (results.length === 0) return res.status(404).json({ message: 'Label not found' });
          
          const item = results[0];
          const current_store_id = item.store_id;
          
          if (current_store_id !== parseInt(store_id)) {
            await updateStock(db, item.item_id, current_store_id, -item.received_qty, 'Transfer', label_number, created_by);
            await updateStock(db, item.item_id, store_id, item.received_qty, 'Transfer', label_number, created_by);
          }
          
          db.query(
            'UPDATE fg_receipts SET store_id = ?, bin = ?, status = \'Available\' WHERE fgr_id = ?',
            [store_id, bin, id],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to assign bin', error: err2 });
              res.json({ message: 'Put-Away completed successfully' });
            }
          );
        }
      );
    } else {
      res.status(400).json({ message: 'Invalid label format' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Put-Away operation failed', error: err.message });
  }
};

// 7. Bin transfer
exports.transferStock = async (req, res) => {
  const { label_number, store_id, bin, reason } = req.body;
  const created_by = req.user.user_id;
  
  if (!label_number || !store_id || !bin) {
    return res.status(400).json({ message: 'Label, target store, and target bin are required' });
  }
  
  try {
    const parts = label_number.split('/');
    const prefix = parts[0];
    const id = parseInt(parts[2]);
    
    if (prefix === 'MAT') {
      db.query(
        `SELECT gi.*, g.store_id as current_store_id FROM grn_items gi 
         JOIN grn g ON gi.grn_id = g.grn_id 
         WHERE gi.grn_item_id = ?`,
        [id],
        async (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err });
          if (results.length === 0) return res.status(404).json({ message: 'Label not found' });
          
          const item = results[0];
          const current_store_id = item.current_store_id;
          
          // Transfer stock positions and log
          await updateStock(db, item.item_id, current_store_id, -item.accepted_qty, 'Transfer', `Transfer Out - ${reason || 'Bin Transfer'}`, created_by);
          await updateStock(db, item.item_id, store_id, item.accepted_qty, 'Transfer', `Transfer In - ${reason || 'Bin Transfer'}`, created_by);
          
          db.query('UPDATE grn SET store_id = ? WHERE grn_id = ?', [store_id, item.grn_id]);
          db.query(
            'UPDATE grn_items SET bin = ? WHERE grn_item_id = ?',
            [bin, id],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to update bin location', error: err2 });
              res.json({ message: 'Stock transferred successfully' });
            }
          );
        }
      );
    } else if (prefix === 'FGL') {
      db.query(
        'SELECT * FROM fg_receipts WHERE fgr_id = ?',
        [id],
        async (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err });
          if (results.length === 0) return res.status(404).json({ message: 'Label not found' });
          
          const item = results[0];
          const current_store_id = item.store_id;
          
          await updateStock(db, item.item_id, current_store_id, -item.received_qty, 'Transfer', `Transfer Out - ${reason || 'Bin Transfer'}`, created_by);
          await updateStock(db, item.item_id, store_id, item.received_qty, 'Transfer', `Transfer In - ${reason || 'Bin Transfer'}`, created_by);
          
          db.query(
            'UPDATE fg_receipts SET store_id = ?, bin = ? WHERE fgr_id = ?',
            [store_id, bin, id],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to transfer finished goods', error: err2 });
              res.json({ message: 'Stock transferred successfully' });
            }
          );
        }
      );
    } else {
      res.status(400).json({ message: 'Invalid label format' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Stock transfer failed', error: err.message });
  }
};

// 8. Stock adjustment (manual adjust quantity)
exports.adjustStock = async (req, res) => {
  const { label_number, new_qty, reason } = req.body;
  const created_by = req.user.user_id;
  
  if (!label_number || new_qty === undefined || new_qty === '') {
    return res.status(400).json({ message: 'Label and new quantity are required' });
  }
  
  try {
    const parts = label_number.split('/');
    const prefix = parts[0];
    const id = parseInt(parts[2]);
    const targetQty = parseFloat(new_qty);
    
    if (prefix === 'MAT') {
      db.query(
        `SELECT gi.*, g.store_id FROM grn_items gi 
         JOIN grn g ON gi.grn_id = g.grn_id 
         WHERE gi.grn_item_id = ?`,
        [id],
        async (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err });
          if (results.length === 0) return res.status(404).json({ message: 'Label not found' });
          
          const item = results[0];
          const old_qty = parseFloat(item.accepted_qty);
          const diff = targetQty - old_qty;
          const status = targetQty <= 0 ? 'Consumed' : item.status;
          
          await updateStock(db, item.item_id, item.store_id, diff, 'Adjustment', `Adjust - ${reason || 'Manual Adjustment'}`, created_by);
          
          db.query(
            'UPDATE grn_items SET accepted_qty = ?, status = ? WHERE grn_item_id = ?',
            [targetQty, status, id],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to adjust stock quantity', error: err2 });
              res.json({ message: 'Stock adjusted successfully' });
            }
          );
        }
      );
    } else if (prefix === 'FGL') {
      db.query(
        'SELECT * FROM fg_receipts WHERE fgr_id = ?',
        [id],
        async (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err });
          if (results.length === 0) return res.status(404).json({ message: 'Label not found' });
          
          const item = results[0];
          const old_qty = parseFloat(item.received_qty);
          const diff = targetQty - old_qty;
          const status = targetQty <= 0 ? 'Consumed' : item.status;
          
          await updateStock(db, item.item_id, item.store_id, diff, 'Adjustment', `Adjust - ${reason || 'Manual Adjustment'}`, created_by);
          
          db.query(
            'UPDATE fg_receipts SET received_qty = ?, status = ? WHERE fgr_id = ?',
            [targetQty, status, id],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to adjust stock quantity', error: err2 });
              res.json({ message: 'Stock adjusted successfully' });
            }
          );
        }
      );
    } else {
      res.status(400).json({ message: 'Invalid label format' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Stock adjustment failed', error: err.message });
  }
};

// 9. Issue material to production (Decrease stock & set status)
exports.issueMaterial = async (req, res) => {
  const { label_number, issue_qty, work_order_no, remarks } = req.body;
  const created_by = req.user.user_id;
  
  if (!label_number || !issue_qty || parseFloat(issue_qty) <= 0) {
    return res.status(400).json({ message: 'Label and a valid issue quantity are required' });
  }
  
  try {
    const parts = label_number.split('/');
    const prefix = parts[0];
    const id = parseInt(parts[2]);
    const issueAmount = parseFloat(issue_qty);
    
    if (prefix === 'MAT') {
      db.query(
        `SELECT gi.*, g.store_id FROM grn_items gi 
         JOIN grn g ON gi.grn_id = g.grn_id 
         WHERE gi.grn_item_id = ?`,
        [id],
        async (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err });
          if (results.length === 0) return res.status(404).json({ message: 'Label not found' });
          
          const item = results[0];
          const available_qty = parseFloat(item.accepted_qty);
          
          if (available_qty < issueAmount) {
            return res.status(400).json({ message: `Insufficient stock. Available: ${available_qty} ${item.unit}` });
          }
          
          const remaining_qty = available_qty - issueAmount;
          const status = remaining_qty <= 0 ? 'Consumed' : item.status;
          
          // Decrease stock levels and write log
          await updateStock(db, item.item_id, item.store_id, -issueAmount, 'Issue', `Issue to WO ${work_order_no || 'N/A'} - ${remarks || ''}`, created_by);
          
          db.query(
            'UPDATE grn_items SET accepted_qty = ?, status = ? WHERE grn_item_id = ?',
            [remaining_qty, status, id],
            (err2) => {
              if (err2) return res.status(500).json({ message: 'Failed to issue material', error: err2 });
              res.json({ message: 'Material issued successfully', remaining_qty });
            }
          );
        }
      );
    } else {
      res.status(400).json({ message: 'Only raw materials (MAT labels) can be issued to production' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Material issue failed', error: err.message });
  }
};

// 10. Get all users/operators
exports.getUsers = (req, res) => {
  db.query('SELECT user_id, name, email, role, department FROM users ORDER BY name ASC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve users', error: err.message });
    res.json(results);
  });
};

// 11. Get all active items
exports.getItems = (req, res) => {
  db.query('SELECT item_id, item_code, item_name, category, unit, status FROM items WHERE status = "Active" ORDER BY item_name ASC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve items', error: err.message });
    res.json(results);
  });
};

