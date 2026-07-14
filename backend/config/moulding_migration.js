const db = require('./db');

const ddlStatements = [
  // 1. Alter machines table to support platen sizes and clamping force capacities
  `ALTER TABLE machines 
   ADD COLUMN capacity_tons INT NULL,
   ADD COLUMN platen_length INT NULL,
   ADD COLUMN platen_width INT NULL,
   ADD COLUMN daylights INT NULL DEFAULT 1,
   ADD COLUMN heating_type VARCHAR(50) NULL DEFAULT 'Electric',
   ADD COLUMN max_temperature INT NULL DEFAULT 200,
   ADD COLUMN max_pressure INT NULL DEFAULT 200,
   ADD COLUMN moulding_type VARCHAR(50) NULL DEFAULT 'Compression'`,

  // 2. Create moulds table
  `CREATE TABLE IF NOT EXISTS moulds (
    mould_id INT AUTO_INCREMENT PRIMARY KEY,
    mould_code VARCHAR(50) UNIQUE NOT NULL,
    mould_name VARCHAR(100) NOT NULL,
    item_id INT NOT NULL,
    mould_type VARCHAR(50) NOT NULL,
    cavities INT NOT NULL DEFAULT 1,
    total_shots_allowed INT NOT NULL DEFAULT 500000,
    shots_used INT NOT NULL DEFAULT 0,
    mould_material VARCHAR(50) DEFAULT 'P20 Steel',
    platen_length INT DEFAULT 450,
    platen_width INT DEFAULT 450,
    platen_height INT DEFAULT 150,
    weight_kg DECIMAL(10, 2) DEFAULT 0.00,
    last_maintenance_date DATE NULL,
    maintenance_due_shots INT NOT NULL DEFAULT 480000,
    status VARCHAR(50) NOT NULL DEFAULT 'Available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 3. Create mould_maintenance_log table
  `CREATE TABLE IF NOT EXISTS mould_maintenance_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    mould_id INT NOT NULL,
    maintenance_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    maintenance_type VARCHAR(50) NOT NULL,
    shots_at_maintenance INT NOT NULL,
    done_by VARCHAR(100) NOT NULL,
    remarks TEXT NULL,
    next_due_shots INT NOT NULL
  )`,

  // 4. Create mould_machine_mapping table
  `CREATE TABLE IF NOT EXISTS mould_machine_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mould_id INT NOT NULL,
    machine_id INT NOT NULL,
    UNIQUE KEY uq_mould_machine (mould_id, machine_id)
  )`,

  // 5. Create moulding_job_cards table
  `CREATE TABLE IF NOT EXISTS moulding_job_cards (
    jc_id INT AUTO_INCREMENT PRIMARY KEY,
    jc_number VARCHAR(50) UNIQUE NOT NULL,
    wo_id INT NOT NULL,
    item_id INT NOT NULL,
    customer_id INT NULL,
    fb_id INT NOT NULL,
    compound_weight_required DECIMAL(10, 3) NOT NULL,
    mould_id INT NOT NULL,
    machine_id INT NOT NULL,
    planned_qty INT NOT NULL,
    shots_required INT NOT NULL,
    moulding_temp INT DEFAULT 160,
    moulding_pressure INT DEFAULT 150,
    curing_time INT DEFAULT 4,
    planned_start DATETIME NULL,
    planned_end DATETIME NULL,
    actual_start DATETIME NULL,
    actual_end DATETIME NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 6. Create moulding_production_entries table
  `CREATE TABLE IF NOT EXISTS moulding_production_entries (
    entry_id INT AUTO_INCREMENT PRIMARY KEY,
    jc_id INT NOT NULL,
    machine_id INT NOT NULL,
    operator_id INT NOT NULL,
    shift VARCHAR(20) NOT NULL,
    entry_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shots_completed INT NOT NULL,
    good_parts INT NOT NULL,
    rejected_parts INT NOT NULL,
    downtime_minutes INT DEFAULT 0,
    downtime_reason VARCHAR(100) NULL,
    remarks TEXT NULL
  )`,

  // 7. Create moulding_rejection_log table
  `CREATE TABLE IF NOT EXISTS moulding_rejection_log (
    rej_id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    rejection_reason_code VARCHAR(10) NOT NULL,
    rejected_qty INT NOT NULL,
    remarks TEXT NULL
  )`,

  // 8. Create moulding_purge_log table
  `CREATE TABLE IF NOT EXISTS moulding_purge_log (
    purge_id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT NOT NULL,
    operator_id INT NOT NULL,
    purge_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    purge_reason VARCHAR(100) NOT NULL,
    compound_used VARCHAR(100) NOT NULL,
    quantity_kg DECIMAL(10, 3) NOT NULL
  )`
];

async function runMigration() {
  console.log('🚀 Starting Moulding DDL migration...');
  
  for (const sql of ddlStatements) {
    try {
      await new Promise((resolve, reject) => {
        db.query(sql, (err, res) => {
          if (err && err.code !== 'ER_DUP_FIELDNAME') {
            return reject(err);
          }
          resolve(res);
        });
      });
      console.log('✅ Executed DDL step successfully.');
    } catch (e) {
      console.error('❌ DDL step failed:', e.message);
      process.exit(1);
    }
  }

  console.log('🚀 Seeding finished goods products items...');
  const seedItems = [
    ['FG001', 'Door Panel Seal (Hero)', 'Finished Good', 'Nos', 1],
    ['FG002', 'Engine Grommet Type A (Honda)', 'Finished Good', 'Nos', 2],
    ['FG003', 'Oil Seal ring 45mm (Yamaha)', 'Finished Good', 'Nos', 3]
  ];

  for (const item of seedItems) {
    db.query(
      `INSERT INTO items (item_code, item_name, category, unit, customer_id, reorder_level) 
       VALUES (?, ?, ?, ?, ?, 1000) 
       ON DUPLICATE KEY UPDATE item_name=VALUES(item_name)`,
      item,
      (err) => { if (err) console.error('Error seeding item:', err.message); }
    );
  }

  console.log('🚀 Seeding moulding press machines...');
  const seedMachines = [
    ['HMP-01', 'Hydraulic Moulding Press 1', 'Molding', 180, 8, 'Moulding Dept', 'Active', 100, 450, 450, 'Compression'],
    ['HMP-02', 'Hydraulic Moulding Press 2', 'Molding', 240, 8, 'Moulding Dept', 'Active', 150, 500, 500, 'Compression'],
    ['HMP-03', 'Hydraulic Moulding Press 3', 'Molding', 300, 8, 'Moulding Dept', 'Active', 200, 600, 600, 'Compression'],
    ['HMP-04', 'Hydraulic Moulding Press 4', 'Molding', 180, 8, 'Moulding Dept', 'Active', 100, 450, 450, 'Compression'],
    ['TMP-01', 'Transfer Moulding Press 1', 'Molding', 240, 8, 'Moulding Dept', 'Active', 150, 500, 500, 'Transfer'],
    ['INJ-01', 'Injection Moulding Machine 1', 'Molding', 300, 8, 'Moulding Dept', 'Active', 200, 600, 400, 'Injection'],
    ['HMP-05', 'Hydraulic Press 5', 'Molding', 360, 8, 'Moulding Dept', 'Active', 250, 700, 700, 'Compression']
  ];

  for (const mac of seedMachines) {
    db.query(
      `INSERT INTO machines (machine_code, machine_name, machine_type, ideal_cycle_time, planned_hours_per_shift, location, status, capacity_tons, platen_length, platen_width, moulding_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE capacity_tons=VALUES(capacity_tons), platen_length=VALUES(platen_length), platen_width=VALUES(platen_width), moulding_type=VALUES(moulding_type)`,
      mac,
      (err) => { if (err) console.error('Error seeding machine:', err.message); }
    );
  }

  setTimeout(async () => {
    console.log('🚀 Seeding molds data...');
    db.query('SELECT item_id, item_code FROM items WHERE category = "Finished Good"', (err, itemRows) => {
      if (err || itemRows.length === 0) return console.error('Items lookup failed for molds seed');
      
      const fgItems = {};
      itemRows.forEach(r => fgItems[r.item_code] = r.item_id);

      const seedMolds = [
        ['MLD/01', 'Door Panel Seal Mould', fgItems['FG001'], 'Compression', 4, 500000, 15200, 'H13 Steel', 450, 450, 150, 85.00, '2026-06-01', 480000, 'Available'],
        ['MLD/02', 'Engine Grommet Mould', fgItems['FG002'], 'Compression', 8, 500000, 478500, 'P20 Steel', 500, 500, 160, 120.00, '2026-05-15', 480000, 'Available'],
        ['MLD/03', 'Oil Seal Mould', fgItems['FG003'], 'Transfer', 16, 300000, 298400, 'H13 Steel', 500, 500, 180, 145.00, '2026-04-10', 290000, 'Under Maintenance']
      ];

      for (const mld of seedMolds) {
        db.query(
          `INSERT INTO moulds (mould_code, mould_name, item_id, mould_type, cavities, total_shots_allowed, shots_used, mould_material, platen_length, platen_width, platen_height, weight_kg, last_maintenance_date, maintenance_due_shots, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE shots_used=VALUES(shots_used), status=VALUES(status)`,
          mld,
          (err) => { if (err) console.error('Error seeding mould:', err.message); }
        );
      }
    });

    db.query('SELECT item_id, item_code FROM items WHERE category = "Finished Good"', (err, itemsRes) => {
      if (err || itemsRes.length === 0) return;
      const fgItems = {};
      itemsRes.forEach(r => fgItems[r.item_code] = r.item_id);

      db.query(
        `INSERT INTO work_orders (wo_number, item_id, customer_id, planned_qty, produced_qty, planned_start, planned_end, machine_id, status, created_by)
         VALUES ('WO/2026/00095', ?, 2, 1200, 0, '2026-07-04', '2026-07-10', 2, 'Released', 1)
         ON DUPLICATE KEY UPDATE status='Released'`,
        [fgItems['FG002']],
        (errWo) => {
          if (errWo) console.error('Error seeding work order:', errWo.message);
          
          setTimeout(() => {
            db.query('SELECT wo_id FROM work_orders WHERE wo_number = "WO/2026/00095"', (errWo2, woRows) => {
              if (errWo2 || woRows.length === 0) return;
              const woId = woRows[0].wo_id;
              
              db.query('SELECT fb_id FROM final_batches LIMIT 1', (errFb, fbRows) => {
                if (errFb || fbRows.length === 0) return;
                const fbId = fbRows[0].fb_id;

                db.query('SELECT mould_id FROM moulds WHERE mould_code = "MLD/02"', (errMld, mldRows) => {
                  if (errMld || mldRows.length === 0) return;
                  const mouldId = mldRows[0].mould_id;

                  db.query('SELECT machine_id FROM machines WHERE machine_code = "HMP-02"', (errMac, macRows) => {
                    if (errMac || macRows.length === 0) return;
                    const machineId = macRows[0].machine_id;

                    const jobCard = [
                      'JC/2026/00001', woId, fgItems['FG002'], 2, fbId, 15.500, mouldId, machineId, 1200, 150, 160, 150, 4, '2026-07-06 08:00:00', '2026-07-06 18:00:00', 'Pending'
                    ];

                    db.query(
                      `INSERT INTO moulding_job_cards (jc_number, wo_id, item_id, customer_id, fb_id, compound_weight_required, mould_id, machine_id, planned_qty, shots_required, moulding_temp, moulding_pressure, curing_time, planned_start, planned_end, status)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                       ON DUPLICATE KEY UPDATE status=VALUES(status)`,
                      jobCard,
                      (errJc) => {
                        if (errJc) console.error('Error seeding job card:', errJc.message);
                        else console.log('🎉 Successfully seeded Moulding Job Card JC/2026/00001');
                      }
                    );
                  });
                });
              });
            });
          }, 500);
        }
      );
    });

    console.log('✅ Migration database script finished execution.');
  }, 1000);
}

runMigration();
