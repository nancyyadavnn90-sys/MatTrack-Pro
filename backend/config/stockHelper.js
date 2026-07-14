const updateStock = (db, item_id, store_id, qty_change, transaction_type, reference_number, created_by) => {
  return new Promise((resolve, reject) => {
    const qty = parseFloat(qty_change || 0);
    
    // Find current stock position
    db.query(
      'SELECT stock_id, current_qty FROM stock_positions WHERE item_id = ? AND store_id = ?',
      [item_id, store_id],
      (err, results) => {
        if (err) return reject(err);
        
        let old_qty = 0;
        let exists = false;
        let stock_id = null;
        
        if (results.length > 0) {
          old_qty = parseFloat(results[0].current_qty || 0);
          stock_id = results[0].stock_id;
          exists = true;
        }
        
        const new_qty = old_qty + qty;
        
        const saveStockPos = () => {
          if (exists) {
            db.query(
              'UPDATE stock_positions SET current_qty = ?, last_updated = NOW() WHERE stock_id = ?',
              [new_qty, stock_id],
              (err2) => {
                if (err2) return reject(err2);
                writeLedger();
              }
            );
          } else {
            db.query(
              'INSERT INTO stock_positions (item_id, store_id, current_qty, last_updated) VALUES (?, ?, ?, NOW())',
              [item_id, store_id, new_qty],
              (err2) => {
                if (err2) return reject(err2);
                writeLedger();
              }
            );
          }
        };

        const writeLedger = () => {
          const qty_in = qty > 0 ? qty : 0;
          const qty_out = qty < 0 ? Math.abs(qty) : 0;
          db.query(
            `INSERT INTO stock_ledger 
              (item_id, store_id, transaction_type, reference_number, qty_in, qty_out, balance, created_by, transaction_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [item_id, store_id, transaction_type, reference_number, qty_in, qty_out, new_qty, created_by],
            (err3) => {
              if (err3) return reject(err3);
              resolve(new_qty);
            }
          );
        };

        saveStockPos();
      }
    );
  });
};

module.exports = { updateStock };
