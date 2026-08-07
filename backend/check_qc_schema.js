const db = require('./config/db');

db.query("DESCRIBE qc_inspections", (err, res) => {
  console.log('QC_INSPECTIONS SCHEMA:', res ? res.map(r => r.Field) : err);
  process.exit(0);
});
