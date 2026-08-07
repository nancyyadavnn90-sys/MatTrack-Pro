const db = require('./config/db');

db.query("SELECT item_id, item_code, item_name FROM items LIMIT 10", (err, res) => {
  console.log('EXISTING ITEM IDs:', res);
  db.query("SELECT customer_id, customer_name FROM customers LIMIT 10", (err2, res2) => {
    console.log('EXISTING CUSTOMER IDs:', res2);
    process.exit(0);
  });
});
