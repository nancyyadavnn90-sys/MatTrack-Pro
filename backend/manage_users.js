const mysql = require('mysql2');
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

  const ALL_FEATURES = ['Dashboard', 'GatePass', 'GRN', 'Store', 'Quality', 'Production', 'FG', 'Dispatch', 'ShopFloor', 'Reports', 'Admin'];

  // Role permissions rules
  const rolePermissionsMap = {
    'System Administrator': ALL_FEATURES,
    'Admin': ALL_FEATURES,
    'GateKeeper': ['Dashboard', 'GatePass'],
    'StoreUser': ['Dashboard', 'Store', 'GRN', 'FG'],
    'QCInspector': ['Dashboard', 'Quality'],
    'ProductionPlanner': ['Dashboard', 'Production', 'ShopFloor', 'Reports'],
    'Operator': ['Dashboard', 'Production', 'ShopFloor'],
    'DispatchUser': ['Dashboard', 'FG', 'Dispatch'],
    'ShopFloorUser': ['Dashboard', 'Production', 'ShopFloor'],
    'Viewer': ['Dashboard', 'Reports']
  };

  // Clear existing permissions and insert exact matrix
  db.query(`TRUNCATE TABLE permissions`, (tErr) => {
    if (tErr) console.error('Truncate permissions err:', tErr);

    const insertValues = [];
    Object.keys(rolePermissionsMap).forEach(role => {
      const allowedFeats = rolePermissionsMap[role];
      ALL_FEATURES.forEach(feat => {
        const canView = allowedFeats.includes(feat) ? 1 : 0;
        insertValues.push([role, feat, canView, canView, canView, canView, canView, canView]);
      });
    });

    const sql = `INSERT INTO permissions (role_name, feature_name, can_view, can_create, can_edit, can_delete, can_approve, can_print) VALUES ?`;
    db.query(sql, [insertValues], (iErr, iRes) => {
      if (iErr) console.error('Insert perms err:', iErr);
      else console.log(`✅ Configured exact role permissions matrix. Rows inserted: ${iRes.affectedRows}`);

      // Ensure all users exist
      const usersToUpsert = [
        { name: 'System Administrator', email: 'admin@jayashree.com', role: 'System Administrator', department: 'Admin' },
        { name: 'Nancy Yadav', email: 'nancy@jayashree.com', role: 'System Administrator', department: 'Admin' },
        { name: 'Khushi Saini', email: 'khushi@jayashree.com', role: 'System Administrator', department: 'Admin' },
        { name: 'GateKeeper', email: 'gate@jayashree.com', role: 'GateKeeper', department: 'Security' },
        { name: 'StoreUser', email: 'store@jayashree.com', role: 'StoreUser', department: 'Store' },
        { name: 'QCInspector', email: 'qc@jayashree.com', role: 'QCInspector', department: 'Quality' },
        { name: 'ProductionPlanner', email: 'production@jayashree.com', role: 'ProductionPlanner', department: 'Production' },
        { name: 'DispatchUser', email: 'dispatch@jayashree.com', role: 'DispatchUser', department: 'Dispatch' },
        { name: 'Security', email: 'security@jayashree.com', role: 'GateKeeper', department: 'Security' },
        { name: 'ShopFloorUser', email: 'shopfloor@jayashree.com', role: 'ShopFloorUser', department: 'Production' },
        { name: 'Viewer', email: 'viewer@jayashree.com', role: 'Viewer', department: 'Management' }
      ];

      usersToUpsert.forEach(u => {
        db.query(`UPDATE users SET name = ?, role = ?, department = ?, status = 'Active' WHERE email = ?`, [u.name, u.role, u.department, u.email]);
      });

      setTimeout(() => {
        db.end();
      }, 1000);
    });
  });
});
