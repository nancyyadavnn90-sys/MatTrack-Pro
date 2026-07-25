const db = require('../config/db');
const bcrypt = require('bcryptjs');

// ==================== USERS ====================
exports.getUsers = (req, res) => {
  db.query(`SELECT user_id, name, email, role, department, status, created_at FROM users ORDER BY user_id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch users', error: err.message });
    res.json(results);
  });
};

exports.createUser = async (req, res) => {
  const { name, email, password, role, department, status } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required.' });

  try {
    const userRole = role || 'Operator';
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(`INSERT INTO users (name, email, password, role, department, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, userRole, department || 'Production', status || 'Active'],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to create user', error: err.message });

        // Auto-seed permissions for role if none exist
        db.query(`SELECT COUNT(*) as count FROM permissions WHERE role_name = ?`, [userRole], (checkErr, checkRes) => {
          if (!checkErr && checkRes && checkRes[0]?.count === 0) {
            const defaultFeatures = ['Dashboard', 'GatePass', 'GRN', 'Store', 'Quality', 'Production', 'FG', 'Dispatch', 'ShopFloor', 'Reports'];
            const values = defaultFeatures.map(f => [userRole, f, 1, 1, 1, 1, 1, 1]);
            db.query(`INSERT INTO permissions (role_name, feature_name, can_view, can_create, can_edit, can_delete, can_approve, can_print) VALUES ?`, [values], () => {});
          }
        });

        res.status(201).json({ message: 'User created successfully', userId: result.insertId });
      });
  } catch (err) {
    res.status(500).json({ message: 'Error hashing password', error: err.message });
  }
};

exports.updateUser = (req, res) => {
  const { id } = req.params;
  const { name, email, role, department, status } = req.body;
  db.query(`UPDATE users SET name = ?, email = ?, role = ?, department = ?, status = ? WHERE user_id = ?`,
    [name, email, role, department, status, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update user', error: err.message });
      res.json({ message: 'User updated successfully' });
    });
};

exports.resetPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 4) return res.status(400).json({ message: 'Password must be at least 4 characters.' });

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.query(`UPDATE users SET password = ? WHERE user_id = ?`, [hashedPassword, id], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to reset password', error: err.message });
      res.json({ message: 'Password reset successfully' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Error hashing password', error: err.message });
  }
};

exports.deleteUser = (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM users WHERE user_id = ?`, [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to delete user', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  });
};

// ==================== ROLES & PERMISSIONS ====================
exports.getRoles = (req, res) => {
  db.query(`SELECT * FROM roles ORDER BY role_name ASC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch roles', error: err.message });
    res.json(results);
  });
};

exports.createRole = (req, res) => {
  const { role_name, initialPermissions } = req.body;
  if (!role_name) return res.status(400).json({ message: 'Role name is required.' });

  db.query(`INSERT INTO roles (role_name) VALUES (?)`, [role_name], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to create role', error: err.message });

    if (initialPermissions && Array.isArray(initialPermissions)) {
      const permSql = `
        INSERT INTO permissions 
        (role_name, feature_name, can_view, can_create, can_edit, can_delete, can_approve, can_print)
        VALUES ? ON DUPLICATE KEY UPDATE
        can_view=VALUES(can_view), can_create=VALUES(can_create), can_edit=VALUES(can_edit),
        can_delete=VALUES(can_delete), can_approve=VALUES(can_approve), can_print=VALUES(can_print)
      `;
      const values = initialPermissions.map(p => [
        role_name, p.feature_name, !!p.can_view, !!p.can_create, !!p.can_edit, !!p.can_delete, !!p.can_approve, !!p.can_print
      ]);
      db.query(permSql, [values], () => {});
    }

    res.status(201).json({ message: 'Role created successfully' });
  });
};

exports.getPermissions = (req, res) => {
  db.query(`SELECT * FROM permissions`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch permissions', error: err.message });
    res.json(results);
  });
};

exports.savePermissions = (req, res) => {
  const { role_name, permissions } = req.body;
  if (!role_name || !Array.isArray(permissions)) return res.status(400).json({ message: 'Role and permissions required.' });

  const sql = `
    INSERT INTO permissions 
    (role_name, feature_name, can_view, can_create, can_edit, can_delete, can_approve, can_print)
    VALUES ? ON DUPLICATE KEY UPDATE
    can_view=VALUES(can_view), can_create=VALUES(can_create), can_edit=VALUES(can_edit),
    can_delete=VALUES(can_delete), can_approve=VALUES(can_approve), can_print=VALUES(can_print)
  `;
  const values = permissions.map(p => [
    role_name, p.feature_name, !!p.can_view, !!p.can_create, !!p.can_edit, !!p.can_delete, !!p.can_approve, !!p.can_print
  ]);

  db.query(sql, [values], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to save permissions', error: err.message });
    res.json({ message: 'Permissions saved successfully' });
  });
};

// ==================== PAGE 2: ITEMS MASTER ====================
exports.getItems = (req, res) => {
  db.query(`SELECT * FROM items ORDER BY item_id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch items', error: err.message });
    res.json(results);
  });
};

exports.createItem = (req, res) => {
  const { item_code, item_name, category, unit, customer, reorder_level, description, status } = req.body;
  if (!item_code || !item_name) return res.status(400).json({ message: 'Item code and name are required.' });

  const sql = `INSERT INTO items (item_code, item_name, category, unit, customer, reorder_level, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [item_code, item_name, category || 'Raw Material', unit || 'KG', customer || null, reorder_level || 0, description || '', status || 'Active'], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to create item', error: err.message });
    res.status(201).json({ message: 'Item created successfully', itemId: result.insertId });
  });
};

exports.updateItem = (req, res) => {
  const { id } = req.params;
  const { item_code, item_name, category, unit, customer, reorder_level, description, status } = req.body;

  const sql = `UPDATE items SET item_code = ?, item_name = ?, category = ?, unit = ?, customer = ?, reorder_level = ?, description = ?, status = ? WHERE item_id = ?`;
  db.query(sql, [item_code, item_name, category, unit, customer, reorder_level, description, status, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update item', error: err.message });
    res.json({ message: 'Item updated successfully' });
  });
};

// ==================== PAGE 3: SUPPLIERS MASTER ====================
exports.getSuppliers = (req, res) => {
  db.query(`SELECT * FROM suppliers ORDER BY supplier_id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch suppliers', error: err.message });
    res.json(results);
  });
};

exports.createSupplier = (req, res) => {
  const { supplier_code, supplier_name, contact_person, phone, email, address, city_state_pin, gstin, payment_terms, status } = req.body;
  if (!supplier_name) return res.status(400).json({ message: 'Supplier name is required.' });

  const sql = `INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone, email, address, city_state_pin, gstin, payment_terms, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [supplier_code || `SUP-${Date.now().toString().slice(-4)}`, supplier_name, contact_person, phone, email, address, city_state_pin, gstin, payment_terms || '30 days', status || 'Active'], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to create supplier', error: err.message });
    res.status(201).json({ message: 'Supplier created successfully', supplierId: result.insertId });
  });
};

exports.updateSupplier = (req, res) => {
  const { id } = req.params;
  const { supplier_code, supplier_name, contact_person, phone, email, address, city_state_pin, gstin, payment_terms, status } = req.body;

  const sql = `UPDATE suppliers SET supplier_code = ?, supplier_name = ?, contact_person = ?, phone = ?, email = ?, address = ?, city_state_pin = ?, gstin = ?, payment_terms = ?, status = ? WHERE supplier_id = ?`;
  db.query(sql, [supplier_code, supplier_name, contact_person, phone, email, address, city_state_pin, gstin, payment_terms, status, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update supplier', error: err.message });
    res.json({ message: 'Supplier updated successfully' });
  });
};

// ==================== PAGE 4: CUSTOMERS MASTER ====================
exports.getCustomers = (req, res) => {
  db.query(`SELECT * FROM customers ORDER BY customer_id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch customers', error: err.message });
    res.json(results);
  });
};

exports.createCustomer = (req, res) => {
  const { customer_code, customer_name, short_name, contact_person, phone, email, billing_address, delivery_address, city_state_pin, gstin, payment_terms, status } = req.body;
  if (!customer_name) return res.status(400).json({ message: 'Customer name is required.' });

  const sql = `INSERT INTO customers (customer_code, customer_name, short_name, contact_person, phone, email, billing_address, delivery_address, city_state_pin, gstin, payment_terms, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [customer_code || `CUST-${Date.now().toString().slice(-4)}`, customer_name, short_name, contact_person, phone, email, billing_address, delivery_address, city_state_pin, gstin, payment_terms || '30 days', status || 'Active'], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to create customer', error: err.message });
    res.status(201).json({ message: 'Customer created successfully', customerId: result.insertId });
  });
};

exports.updateCustomer = (req, res) => {
  const { id } = req.params;
  const { customer_code, customer_name, short_name, contact_person, phone, email, billing_address, delivery_address, city_state_pin, gstin, payment_terms, status } = req.body;

  const sql = `UPDATE customers SET customer_code = ?, customer_name = ?, short_name = ?, contact_person = ?, phone = ?, email = ?, billing_address = ?, delivery_address = ?, city_state_pin = ?, gstin = ?, payment_terms = ?, status = ? WHERE customer_id = ?`;
  db.query(sql, [customer_code, customer_name, short_name, contact_person, phone, email, billing_address, delivery_address, city_state_pin, gstin, payment_terms, status, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update customer', error: err.message });
    res.json({ message: 'Customer updated successfully' });
  });
};

// ==================== PAGE 5: MACHINES MASTER ====================
exports.getMachines = (req, res) => {
  db.query(`SELECT * FROM machines ORDER BY machine_id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch machines', error: err.message });
    res.json(results);
  });
};

exports.createMachine = (req, res) => {
  const { machine_code, machine_name, machine_type, capacity_tons, platen_length, platen_width, daylights, heating_type, max_temp, max_pressure, ideal_cycle_time_mins, planned_hours_per_shift, location, installation_date, status } = req.body;
  if (!machine_code || !machine_name) return res.status(400).json({ message: 'Machine code and name are required.' });

  const sql = `INSERT INTO machines (machine_code, machine_name, machine_type, capacity_tons, platen_length, platen_width, daylights, heating_type, max_temp, max_pressure, ideal_cycle_time_mins, planned_hours_per_shift, location, installation_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [machine_code, machine_name, machine_type || 'Compression', capacity_tons || 100, platen_length || 450, platen_width || 450, daylights || 1, heating_type || 'Electric', max_temp || 200, max_pressure || 200, ideal_cycle_time_mins || 5.0, planned_hours_per_shift || 8.0, location || 'Shop Floor Bay 1', installation_date || null, status || 'Running'], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to create machine', error: err.message });
    res.status(201).json({ message: 'Machine created successfully', machineId: result.insertId });
  });
};

exports.updateMachine = (req, res) => {
  const { id } = req.params;
  const { machine_code, machine_name, machine_type, capacity_tons, platen_length, platen_width, daylights, heating_type, max_temp, max_pressure, ideal_cycle_time_mins, planned_hours_per_shift, location, installation_date, status } = req.body;

  const sql = `UPDATE machines SET machine_code = ?, machine_name = ?, machine_type = ?, capacity_tons = ?, platen_length = ?, platen_width = ?, daylights = ?, heating_type = ?, max_temp = ?, max_pressure = ?, ideal_cycle_time_mins = ?, planned_hours_per_shift = ?, location = ?, installation_date = ?, status = ? WHERE machine_id = ?`;
  db.query(sql, [machine_code, machine_name, machine_type, capacity_tons, platen_length, platen_width, daylights, heating_type, max_temp, max_pressure, ideal_cycle_time_mins, planned_hours_per_shift, location, installation_date, status, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update machine', error: err.message });
    res.json({ message: 'Machine updated successfully' });
  });
};

// ==================== PAGE 6: STORE MASTER ====================
exports.getStores = (req, res) => {
  db.query(`SELECT * FROM stores ORDER BY store_id ASC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch stores', error: err.message });
    res.json(results);
  });
};

exports.createStore = (req, res) => {
  const { store_code, store_name, store_type, location, description, status } = req.body;
  if (!store_code || !store_name) return res.status(400).json({ message: 'Store code and name required.' });

  const sql = `INSERT INTO stores (store_code, store_name, store_type, location, description, status) VALUES (?, ?, ?, ?, ?, ?)`;
  db.query(sql, [store_code, store_name, store_type || 'Raw Material', location || 'Ground Floor', description || '', status || 'Active'], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to create store', error: err.message });
    res.status(201).json({ message: 'Store created successfully', storeId: result.insertId });
  });
};

exports.updateStore = (req, res) => {
  const { id } = req.params;
  const { store_code, store_name, store_type, location, description, status } = req.body;

  const sql = `UPDATE stores SET store_code = ?, store_name = ?, store_type = ?, location = ?, description = ?, status = ? WHERE store_id = ?`;
  db.query(sql, [store_code, store_name, store_type, location, description, status, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update store', error: err.message });
    res.json({ message: 'Store updated successfully' });
  });
};

// ==================== PAGE 7: MOULD MASTER ====================
exports.getMoulds = (req, res) => {
  db.query(`SELECT * FROM moulds ORDER BY mould_id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch moulds', error: err.message });
    res.json(results);
  });
};

exports.createMould = (req, res) => {
  const { mould_code, mould_name, product_name, mould_type, cavities, total_shots_allowed, current_shots_used, mould_material, weight_kg, platen_length, platen_width, height_mm, compatible_machines, maintenance_threshold, last_maintenance_date, status } = req.body;
  if (!mould_code || !mould_name) return res.status(400).json({ message: 'Mould code and name are required.' });

  const sql = `INSERT INTO moulds (mould_code, mould_name, product_name, mould_type, cavities, total_shots_allowed, current_shots_used, mould_material, weight_kg, platen_length, platen_width, height_mm, compatible_machines, maintenance_threshold, last_maintenance_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [mould_code, mould_name, product_name, mould_type || 'Compression', cavities || 4, total_shots_allowed || 500000, current_shots_used || 0, mould_material || 'P20 Steel', weight_kg || 150, platen_length || 450, platen_width || 450, height_mm || 250, compatible_machines || '', maintenance_threshold || 480000, last_maintenance_date || null, status || 'Available'], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to create mould', error: err.message });
    res.status(201).json({ message: 'Mould created successfully', mouldId: result.insertId });
  });
};

exports.updateMould = (req, res) => {
  const { id } = req.params;
  const { mould_code, mould_name, product_name, mould_type, cavities, total_shots_allowed, current_shots_used, mould_material, weight_kg, platen_length, platen_width, height_mm, compatible_machines, maintenance_threshold, last_maintenance_date, status } = req.body;

  const sql = `UPDATE moulds SET mould_code = ?, mould_name = ?, product_name = ?, mould_type = ?, cavities = ?, total_shots_allowed = ?, current_shots_used = ?, mould_material = ?, weight_kg = ?, platen_length = ?, platen_width = ?, height_mm = ?, compatible_machines = ?, maintenance_threshold = ?, last_maintenance_date = ?, status = ? WHERE mould_id = ?`;
  db.query(sql, [mould_code, mould_name, product_name, mould_type, cavities, total_shots_allowed, current_shots_used, mould_material, weight_kg, platen_length, platen_width, height_mm, compatible_machines, maintenance_threshold, last_maintenance_date, status, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update mould', error: err.message });
    res.json({ message: 'Mould updated successfully' });
  });
};

// ==================== PAGE 8: NUMBER SERIES ====================
exports.getNumberSeries = (req, res) => {
  db.query(`SELECT * FROM number_series ORDER BY series_id ASC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch number series', error: err.message });
    res.json(results);
  });
};

exports.updateNumberSeries = (req, res) => {
  const { id } = req.params;
  const { prefix, current_number, next_number, digit_length, include_year, year_format, reset_yearly } = req.body;

  const sql = `UPDATE number_series SET prefix = ?, current_number = ?, next_number = ?, digit_length = ?, include_year = ?, year_format = ?, reset_yearly = ? WHERE series_id = ?`;
  db.query(sql, [prefix, current_number, next_number, digit_length, include_year, year_format, reset_yearly, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update number series', error: err.message });
    res.json({ message: 'Number series updated successfully' });
  });
};

// ==================== PAGE 9: SYSTEM SETTINGS ====================
exports.getCompanySettings = (req, res) => {
  db.query(`SELECT * FROM company_settings WHERE setting_id = 1`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch settings', error: err.message });
    res.json(results[0] || {});
  });
};

exports.updateCompanySettings = (req, res) => {
  const {
    company_name, short_name, address_line1, address_line2, gstin, pan, phone, email,
    shift_count, morning_start, morning_end, evening_start, evening_end, night_start, night_end,
    oee_benchmark, oee_slow_threshold, oee_critical_threshold, wip_slow_hours, wip_stuck_hours,
    enable_email_notif, qc_alert_email, oee_alert_email, stock_alert_email, enable_wip_stuck_notif
  } = req.body;

  const sql = `
    UPDATE company_settings SET
    company_name=?, short_name=?, address_line1=?, address_line2=?, gstin=?, pan=?, phone=?, email=?,
    shift_count=?, morning_start=?, morning_end=?, evening_start=?, evening_end=?, night_start=?, night_end=?,
    oee_benchmark=?, oee_slow_threshold=?, oee_critical_threshold=?, wip_slow_hours=?, wip_stuck_hours=?,
    enable_email_notif=?, qc_alert_email=?, oee_alert_email=?, stock_alert_email=?, enable_wip_stuck_notif=?
    WHERE setting_id = 1
  `;
  db.query(sql, [
    company_name, short_name, address_line1, address_line2, gstin, pan, phone, email,
    shift_count, morning_start, morning_end, evening_start, evening_end, night_start, night_end,
    oee_benchmark, oee_slow_threshold, oee_critical_threshold, wip_slow_hours, wip_stuck_hours,
    enable_email_notif, qc_alert_email, oee_alert_email, stock_alert_email, enable_wip_stuck_notif
  ], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update company settings', error: err.message });
    res.json({ message: 'Company settings updated successfully' });
  });
};
