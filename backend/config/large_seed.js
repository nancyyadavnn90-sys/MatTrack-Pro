const db = require('./db');

async function runLargeSeed() {
  console.log('🚀 Starting large database seed routine...');

  // 1. Seed 10 Finished Good Items
  const items = [
    ['FG001', 'Door Panel Seal', 'Finished Good', 'Nos', 1],
    ['FG002', 'Engine Grommet Type A', 'Finished Good', 'Nos', 2],
    ['FG003', 'Oil Seal ring 45mm', 'Finished Good', 'Nos', 3],
    ['FG004', 'Radiator Gasket EPDM', 'Finished Good', 'Nos', 1],
    ['FG005', 'Fuel Hose Bellow Nitrile', 'Finished Good', 'Nos', 2],
    ['FG006', 'Engine Mount Bushing', 'Finished Good', 'Nos', 3],
    ['FG007', 'Suspension Rubber Bumper', 'Finished Good', 'Nos', 1],
    ['FG008', 'Steering Rack Boot NBR', 'Finished Good', 'Nos', 2],
    ['FG009', 'Carburetor Diaphragm', 'Finished Good', 'Nos', 3],
    ['FG010', 'Wiring Harness Grommet', 'Finished Good', 'Nos', 1]
  ];

  for (const item of items) {
    await new Promise((resolve) => {
      db.query(
        `INSERT INTO items (item_code, item_name, category, unit, customer_id, reorder_level) 
         VALUES (?, ?, ?, ?, ?, 1000) 
         ON DUPLICATE KEY UPDATE item_name=VALUES(item_name)`,
        item,
        (err) => {
          if (err) console.error('Item seed failed:', err.message);
          resolve();
        }
      );
    });
  }
  console.log('✅ Finished seeding 10 Finished Goods items.');

  // Fetch FG item IDs
  const itemMap = {};
  await new Promise((resolve) => {
    db.query('SELECT item_id, item_code FROM items WHERE category = "Finished Good"', (err, rows) => {
      if (!err) {
        rows.forEach(r => itemMap[r.item_code] = r.item_id);
      }
      resolve();
    });
  });

  // 2. Seed 10 Moulds
  const moulds = [
    ['MLD/01', 'Door Panel Seal Mould', itemMap['FG001'], 'Compression', 4, 500000, 15200, 'H13 Steel', 450, 450, 150, 85.00, 'Available'],
    ['MLD/02', 'Engine Grommet Mould', itemMap['FG002'], 'Compression', 8, 500000, 478500, 'P20 Steel', 500, 500, 160, 120.00, 'Available'],
    ['MLD/03', 'Oil Seal Mould', itemMap['FG003'], 'Transfer', 16, 300000, 298400, 'H13 Steel', 500, 500, 180, 145.00, 'Under Maintenance'],
    ['MLD/04', 'Radiator Gasket Mould', itemMap['FG004'], 'Compression', 2, 500000, 12000, 'P20 Steel', 450, 450, 140, 78.00, 'Available'],
    ['MLD/05', 'Fuel Hose Bellow Mould', itemMap['FG005'], 'Injection', 4, 400000, 5400, 'H13 Steel', 600, 400, 200, 110.00, 'Available'],
    ['MLD/06', 'Engine Mount Bushing Mould', itemMap['FG006'], 'Compression', 2, 600000, 145000, 'P20 Steel', 500, 500, 220, 160.00, 'Available'],
    ['MLD/07', 'Suspension Bumper Mould', itemMap['FG007'], 'Compression', 4, 500000, 321000, 'P20 Steel', 450, 450, 150, 90.00, 'Available'],
    ['MLD/08', 'Steering Rack Boot Mould', itemMap['FG008'], 'Injection', 4, 400000, 92000, 'H13 Steel', 600, 400, 190, 105.00, 'Available'],
    ['MLD/09', 'Carburetor Diaphragm Mould', itemMap['FG009'], 'Transfer', 32, 200000, 188000, 'H13 Steel', 500, 500, 130, 95.00, 'Available'],
    ['MLD/10', 'Wiring Harness Grommet Mould', itemMap['FG010'], 'Compression', 16, 500000, 4500, 'P20 Steel', 500, 500, 150, 115.00, 'Available']
  ];

  for (const m of moulds) {
    await new Promise((resolve) => {
      db.query(
        `INSERT INTO moulds (mould_code, mould_name, item_id, mould_type, cavities, total_shots_allowed, shots_used, mould_material, platen_length, platen_width, platen_height, weight_kg, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), shots_used=VALUES(shots_used)`,
        m,
        (err) => {
          if (err) console.error('Mould seed failed:', err.message);
          resolve();
        }
      );
    });
  }
  console.log('✅ Finished seeding 10 Mould masters.');

  // 3. Seed 10 Press Operators
  const operators = [
    ['Amit Sharma', 'amit@jayashree.com', 'Operator', 'Production', '9876543210'],
    ['Rohan Verma', 'rohan@jayashree.com', 'Operator', 'Production', '9876543211'],
    ['Sanjay Dutt', 'sanjay@jayashree.com', 'Operator', 'Production', '9876543212'],
    ['Vikram Rathore', 'vikram@jayashree.com', 'Operator', 'Production', '9876543213'],
    ['Karan Johar', 'karan@jayashree.com', 'Operator', 'Production', '9876543214'],
    ['Arjun Kapoor', 'arjun@jayashree.com', 'Operator', 'Production', '9876543215'],
    ['Aditya Roy', 'aditya@jayashree.com', 'Operator', 'Production', '9876543216'],
    ['Siddharth Malhotra', 'siddharth@jayashree.com', 'Operator', 'Production', '9876543217'],
    ['Varun Dhawan', 'varun@jayashree.com', 'Operator', 'Production', '9876543218'],
    ['Ranbir Kapoor', 'ranbir@jayashree.com', 'Operator', 'Production', '9876543219']
  ];

  for (const op of operators) {
    await new Promise((resolve) => {
      db.query(
        `INSERT INTO users (name, email, password, role, department, phone, status)
         VALUES (?, ?, '$2b$10$NHFQb36zYtjkzLdHOde72.Dd3stYfhVehE8CF9byMkJvnnVAfpHZK', ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        op,
        (err) => {
          if (err) console.error('Operator seed failed:', err.message);
          resolve();
        }
      );
    });
  }
  console.log('✅ Finished seeding 10 Operators.');

  // 4. Seed 10 Lab-Approved Final Batches
  // Retrieve compound item_id (Semi Finished Category)
  let sfItemId = 6; // Compound Rubber Slab (EPDM)
  await new Promise((resolve) => {
    db.query('SELECT item_id FROM items WHERE item_code = "SF001" LIMIT 1', (err, rows) => {
      if (!err && rows.length > 0) sfItemId = rows[0].item_id;
      resolve();
    });
  });

  const finalBatches = [
    ['FB/2026/00010', 15, 2, 1, 120.00, 119.50, 'Approved', sfItemId],
    ['FB/2026/00011', 15, 2, 1, 100.00, 99.80, 'Approved', sfItemId],
    ['FB/2026/00012', 15, 2, 1, 150.00, 149.20, 'Approved', sfItemId],
    ['FB/2026/00013', 15, 2, 1, 110.00, 109.40, 'Approved', sfItemId],
    ['FB/2026/00014', 15, 2, 1, 130.00, 129.80, 'Approved', sfItemId],
    ['FB/2026/00015', 15, 2, 1, 90.00, 89.20, 'Approved', sfItemId],
    ['FB/2026/00016', 15, 2, 1, 140.00, 139.70, 'Approved', sfItemId],
    ['FB/2026/00017', 15, 2, 1, 115.00, 114.90, 'Approved', sfItemId],
    ['FB/2026/00018', 15, 2, 1, 105.00, 104.60, 'Approved', sfItemId],
    ['FB/2026/00019', 15, 2, 1, 125.00, 124.30, 'Approved', sfItemId]
  ];

  for (const fb of finalBatches) {
    await new Promise((resolve) => {
      db.query(
        `INSERT INTO final_batches (fb_number, mb_id, machine_id, operator_id, planned_qty, actual_qty, status, item_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        fb,
        (err) => {
          if (err) console.error('Final batch seed failed:', err.message);
          resolve();
        }
      );
    });
  }
  console.log('✅ Finished seeding 10 Approved Final Batches.');

  // 5. Seed 10 Work Orders in Released / In Progress state
  const workOrders = [
    ['WO/2026/00101', itemMap['FG001'], 1, 1000, 'Released', 1],
    ['WO/2026/00102', itemMap['FG002'], 2, 1200, 'Released', 1],
    ['WO/2026/00103', itemMap['FG003'], 3, 1500, 'Released', 1],
    ['WO/2026/00104', itemMap['FG004'], 1, 800, 'Released', 1],
    ['WO/2026/00105', itemMap['FG005'], 2, 2000, 'Released', 1],
    ['WO/2026/00106', itemMap['FG006'], 3, 600, 'Released', 1],
    ['WO/2026/00107', itemMap['FG007'], 1, 1000, 'Released', 1],
    ['WO/2026/00108', itemMap['FG008'], 2, 1400, 'Released', 1],
    ['WO/2026/00109', itemMap['FG009'], 3, 3000, 'Released', 1],
    ['WO/2026/00110', itemMap['FG010'], 1, 1200, 'Released', 1]
  ];

  for (const wo of workOrders) {
    await new Promise((resolve) => {
      db.query(
        `INSERT INTO work_orders (wo_number, item_id, customer_id, planned_qty, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        wo,
        (err) => {
          if (err) console.error('Work order seed failed:', err.message);
          resolve();
        }
      );
    });
  }
  console.log('✅ Finished seeding 10 Active Work Orders.');

  console.log('🚀 Seeding completed successfully!');
  db.end();
}

runLargeSeed();
