const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];

    if (user.status === 'Inactive') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact system administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Fetch Role Permissions
    const permSql = `SELECT feature_name, can_view, can_create, can_edit, can_delete, can_approve, can_print FROM permissions WHERE role_name = ?`;
    db.query(permSql, [user.role], (permErr, permResults) => {
      const permissionsMap = {};

      if (!permErr && permResults && permResults.length > 0) {
        permResults.forEach(p => {
          permissionsMap[p.feature_name] = {
            can_view: p.can_view === 1 || p.can_view === true || p.can_view === '1',
            can_create: Boolean(p.can_create),
            can_edit: Boolean(p.can_edit),
            can_delete: Boolean(p.can_delete),
            can_approve: Boolean(p.can_approve),
            can_print: Boolean(p.can_print)
          };
        });
      }

      // Default Dashboard to viewable unless explicitly set to false
      if (!permissionsMap['Dashboard']) {
        permissionsMap['Dashboard'] = { can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true, can_print: true };
      }

      res.json({
        message: 'Login successful',
        token,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          permissions: permissionsMap
        }
      });
    });
  });
};