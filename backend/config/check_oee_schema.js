const db = require('./db');

db.query('DESCRIBE shift_logs', (err, slCols) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('shift_logs Columns:');
  console.table(slCols.map(r => ({ Field: r.Field, Type: r.Type, Null: r.Null })));

  db.query('DESCRIBE downtime_logs', (err2, dtCols) => {
    if (err2) {
      console.error(err2);
      process.exit(1);
    }
    console.log('downtime_logs Columns:');
    console.table(dtCols.map(r => ({ Field: r.Field, Type: r.Type, Null: r.Null })));
    db.end(() => process.exit(0));
  });
});
