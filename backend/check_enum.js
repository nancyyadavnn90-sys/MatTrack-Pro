const db = require('./config/db');

db.query("SHOW COLUMNS FROM qc_inspections LIKE 'inspection_type'", (err, res) => {
  console.log('INSPECTION_TYPE ENUM:', res ? res[0].Type : err);
  process.exit(0);
});
