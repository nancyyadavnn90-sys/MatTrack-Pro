const db = require('./config/db');

db.query("DESCRIBE moulds", (err, res1) => {
  console.log('MOULDS SCHEMA:', res1 ? res1.map(r => r.Field) : err);
  db.query("DESCRIBE final_batches", (err2, res2) => {
    console.log('FINAL_BATCHES SCHEMA:', res2 ? res2.map(r => r.Field) : err2);
    db.query("DESCRIBE moulding_job_cards", (err3, res3) => {
      console.log('MOULDING_JOB_CARDS SCHEMA:', res3 ? res3.map(r => r.Field) : err3);
      process.exit(0);
    });
  });
});
