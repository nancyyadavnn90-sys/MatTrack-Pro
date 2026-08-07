const db = require('./config/db');

console.log('--- TESTING MYSQL DATA DIRECTLY ---');

db.query('SELECT COUNT(*) as cnt FROM users', (err, res) => {
  console.log('USERS COUNT:', res ? res[0].cnt : err?.message);
  db.query('SELECT COUNT(*) as cnt FROM items', (err2, res2) => {
    console.log('ITEMS COUNT:', res2 ? res2[0].cnt : err2?.message);
    db.query('SELECT COUNT(*) as cnt FROM work_orders', (err3, res3) => {
      console.log('WORK ORDERS COUNT:', res3 ? res3[0].cnt : err3?.message);
      db.query('SELECT COUNT(*) as cnt FROM moulding_job_cards', (err4, res4) => {
        console.log('MOULDING JOB CARDS COUNT:', res4 ? res4[0].cnt : err4?.message);
        db.query('SELECT COUNT(*) as cnt FROM gate_passes', (err5, res5) => {
          console.log('GATE PASSES COUNT:', res5 ? res5[0].cnt : err5?.message);
          db.query('SELECT COUNT(*) as cnt FROM qc_inspections', (err6, res6) => {
            console.log('QC INSPECTIONS COUNT:', res6 ? res6[0].cnt : err6?.message);
            process.exit(0);
          });
        });
      });
    });
  });
});
