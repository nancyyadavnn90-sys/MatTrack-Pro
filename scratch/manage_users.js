const mysql = require('mysql2');
require('dotenv').config({ path: '../backend/.env' });

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wip_oee_db'
});

db.connect(async (err) => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
  console.log('Connected to DB');

  // 1. Update all @mattrack.local to @jayashree.com
  db.query(`UPDATE users SET email = REPLACE(email, '@mattrack.local', '@jayashree.com')`, (err, res) => {
    if (err) console.error('Error updating emails:', err);
    else console.log('Updated emails @mattrack.local -> @jayashree.com, affected rows:', res.affectedRows);

    // 2. Delete unwanted users like 'dev', 'devdueby@gmail.com'
    db.query(`DELETE FROM users WHERE email NOT LIKE '%@jayashree.com' AND name NOT LIKE '%nancy%' AND name NOT LIKE '%khushi%' AND email NOT LIKE '%nancy%' AND email NOT LIKE '%khushi%'`, (delErr, delRes) => {
      if (delErr) console.error('Error deleting users:', delErr);
      else console.log('Deleted extra test users, affected rows:', delRes.affectedRows);

      // 3. Print remaining clean user list
      db.query(`SELECT user_id, name, email, role, status FROM users`, (selErr, users) => {
        if (selErr) console.error(selErr);
        else console.log('CURRENT USERS IN DB:\n', JSON.stringify(users, null, 2));
        db.end();
      });
    });
  });
});
