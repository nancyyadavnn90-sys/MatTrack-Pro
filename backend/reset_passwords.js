const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
require('dotenv').config();

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

  const defaultPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  db.query(`UPDATE users SET password = ?`, [hashedPassword], (err, res) => {
    if (err) {
      console.error('Failed to update passwords:', err);
    } else {
      console.log(`✅ Successfully reset passwords for ALL users to "${defaultPassword}". Affected rows: ${res.affectedRows}`);
    }
    db.end();
  });
});
