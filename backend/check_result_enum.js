const db = require('./config/db');

db.query("SHOW COLUMNS FROM qc_inspections LIKE 'result'", (err, res) => {
  console.log('RESULT ENUM:', res ? res[0].Type : err);
  process.exit(0);
});
