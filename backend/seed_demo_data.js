const db = require('./config/db');

async function seedData() {
  console.log('🌱 Seeding rich demo data into MySQL database...');

  const queryAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) return resolve(null);
        resolve(results);
      });
    });
  };

  // 1. Create Tables if missing
  await queryAsync(`
    CREATE TABLE IF NOT EXISTS items (
      item_id INT AUTO_INCREMENT PRIMARY KEY,
      item_code VARCHAR(50) UNIQUE,
      item_name VARCHAR(150),
      category VARCHAR(50),
      uom VARCHAR(20),
      current_stock INT DEFAULT 0,
      reorder_level INT DEFAULT 100,
      unit_price DECIMAL(10,2) DEFAULT 0.00,
      status VARCHAR(20) DEFAULT 'Active'
    )
  `);

  await queryAsync(`
    CREATE TABLE IF NOT EXISTS work_orders (
      wo_id INT AUTO_INCREMENT PRIMARY KEY,
      wo_number VARCHAR(50) UNIQUE,
      customer_name VARCHAR(100),
      item_name VARCHAR(150),
      planned_qty INT DEFAULT 1000,
      produced_qty INT DEFAULT 0,
      status VARCHAR(30) DEFAULT 'In Progress',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryAsync(`
    CREATE TABLE IF NOT EXISTS batches (
      batch_id INT AUTO_INCREMENT PRIMARY KEY,
      batch_number VARCHAR(50) UNIQUE,
      wo_number VARCHAR(50),
      product_name VARCHAR(150),
      stage VARCHAR(50) DEFAULT 'MIXING',
      status VARCHAR(30) DEFAULT 'In Progress',
      quantity INT DEFAULT 500,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryAsync(`
    CREATE TABLE IF NOT EXISTS qc_inspections (
      qc_id INT AUTO_INCREMENT PRIMARY KEY,
      inspection_no VARCHAR(50) UNIQUE,
      batch_no VARCHAR(50),
      item_name VARCHAR(150),
      sample_size INT DEFAULT 100,
      passed_qty INT DEFAULT 98,
      failed_qty INT DEFAULT 2,
      result VARCHAR(30) DEFAULT 'Passed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryAsync(`
    CREATE TABLE IF NOT EXISTS shift_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      shift_date DATE,
      shift_name VARCHAR(20),
      machine_id VARCHAR(50),
      operating_time INT DEFAULT 420,
      planned_time INT DEFAULT 480,
      good_parts INT DEFAULT 1450,
      total_parts INT DEFAULT 1500,
      oee_score DECIMAL(5,2) DEFAULT 85.50
    )
  `);

  await queryAsync(`
    CREATE TABLE IF NOT EXISTS gate_passes (
      gate_pass_id INT AUTO_INCREMENT PRIMARY KEY,
      gp_number VARCHAR(50) UNIQUE,
      party_name VARCHAR(100),
      vehicle_no VARCHAR(30),
      material_desc VARCHAR(255),
      status VARCHAR(30) DEFAULT 'Entry Approved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryAsync(`
    CREATE TABLE IF NOT EXISTS dispatch_orders (
      do_id INT AUTO_INCREMENT PRIMARY KEY,
      do_number VARCHAR(50) UNIQUE,
      customer_name VARCHAR(100),
      item_name VARCHAR(150),
      total_qty INT DEFAULT 5000,
      vehicle_no VARCHAR(30),
      status VARCHAR(30) DEFAULT 'Dispatched',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Seed Items
  await queryAsync(`
    INSERT INTO items (item_code, item_name, category, uom, current_stock, reorder_level, unit_price)
    VALUES 
    ('RM-NBR-01', 'NBR Synthetic Rubber Polymer', 'Raw Material', 'KG', 450, 200, 185.00),
    ('RM-ZNC-02', 'Zinc Oxide Active Grade', 'Chemical', 'KG', 80, 100, 320.00),
    ('RM-CB-03', 'Carbon Black N330 Filler', 'Chemical', 'KG', 620, 250, 95.00),
    ('FG-GRM-101', 'Engine Grommet Type A (Hero)', 'Finished Goods', 'PCS', 12500, 2000, 45.00),
    ('FG-TUBE-202', 'Rubber Hose Tube T-05 (Honda)', 'Finished Goods', 'PCS', 8400, 1500, 85.00),
    ('FG-SEAL-303', 'Oil Seal Ring B (Yamaha)', 'Finished Goods', 'PCS', 15200, 3000, 28.00)
    ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock)
  `);

  // 3. Seed Work Orders
  await queryAsync(`
    INSERT INTO work_orders (wo_number, customer_name, item_name, planned_qty, produced_qty, status)
    VALUES
    ('WO-1001', 'Hero MotoCorp Ltd.', 'Engine Grommet Type A', 18000, 14320, 'In Progress'),
    ('WO-1002', 'Honda Motorcycle & Scooter', 'Rubber Hose Tube T-05', 10000, 9800, 'In Progress'),
    ('WO-1003', 'Yamaha Motor India', 'Oil Seal Ring B', 25000, 25000, 'Completed'),
    ('WO-1004', 'Suzuki Motorcycle India', 'Silicone Gasket Seal', 12000, 4500, 'In Progress'),
    ('WO-1005', 'TVS Motor Company', 'Fuel Tank Buffer Dampener', 15000, 0, 'Pending')
    ON DUPLICATE KEY UPDATE produced_qty = VALUES(produced_qty)
  `);

  // 4. Seed Batches (WIP)
  await queryAsync(`
    INSERT INTO batches (batch_number, wo_number, product_name, stage, status, quantity)
    VALUES
    ('B/26/042', 'WO-1001', 'Engine Grommet Type A', 'MIXING', 'In Progress', 2500),
    ('B/26/038', 'WO-1001', 'Engine Grommet Type A', 'MOULDING', 'In Progress', 3000),
    ('B/26/034', 'WO-1002', 'Rubber Hose Tube T-05', 'CURING', 'Stuck', 2000),
    ('B/26/031', 'WO-1002', 'Rubber Hose Tube T-05', 'TRIMMING', 'In Progress', 2500),
    ('B/26/029', 'WO-1003', 'Oil Seal Ring B', 'INSPECTION', 'QC Hold', 4000),
    ('B/26/026', 'WO-1003', 'Oil Seal Ring B', 'FINISHED', 'Completed', 5000)
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  // 5. Seed QC Inspections
  await queryAsync(`
    INSERT INTO qc_inspections (inspection_no, batch_no, item_name, sample_size, passed_qty, failed_qty, result)
    VALUES
    ('QC-2026-001', 'B/26/026', 'Oil Seal Ring B', 200, 198, 2, 'Passed'),
    ('QC-2026-002', 'B/26/029', 'Oil Seal Ring B', 150, 140, 10, 'Pending'),
    ('QC-2026-003', 'B/26/031', 'Rubber Hose Tube T-05', 200, 195, 5, 'Passed')
    ON DUPLICATE KEY UPDATE result = VALUES(result)
  `);

  // 6. Seed Shift OEE Logs
  await queryAsync(`
    INSERT INTO shift_logs (shift_date, shift_name, machine_id, operating_time, planned_time, good_parts, total_parts, oee_score)
    VALUES
    (CURDATE(), 'Morning', 'M-01 Moulding Press', 440, 480, 1850, 1900, 89.20),
    (CURDATE(), 'Morning', 'M-02 Hydraulic Press', 410, 480, 1600, 1700, 81.50),
    (CURDATE(), 'Morning', 'M-03 Compression Press', 320, 480, 950, 1200, 58.00),
    (CURDATE(), 'Morning', 'M-04 Rubber Banbury Mixer', 450, 480, 2200, 2250, 92.40)
  `);

  // 7. Seed Gate Passes
  await queryAsync(`
    INSERT INTO gate_passes (gp_number, party_name, vehicle_no, material_desc, status)
    VALUES
    ('GP-2026-081', 'Polimerchem Industries', 'HR-55-AB-1234', 'Synthetic Rubber NBR 25 Tons', 'Approved'),
    ('GP-2026-082', 'Reliance Elastomers Ltd.', 'MH-12-CD-5678', 'Carbon Black N330 Bags', 'Entry Approved'),
    ('GP-2026-083', 'Supreme Rubber Compounding', 'DL-01-EF-9012', 'Zinc Oxide & Vulcanization Chemicals', 'Pending')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  // 8. Seed Dispatch Orders
  await queryAsync(`
    INSERT INTO dispatch_orders (do_number, customer_name, item_name, total_qty, vehicle_no, status)
    VALUES
    ('DO-2026-001', 'Hero MotoCorp Ltd.', 'Engine Grommet Type A', 10000, 'HR-26-XX-9999', 'Dispatched'),
    ('DO-2026-002', 'Honda Motorcycle & Scooter', 'Rubber Hose Tube T-05', 6000, 'HR-55-YY-8888', 'In Transit')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  console.log('✅ Demo data successfully seeded into MySQL database!');
  process.exit(0);
}

seedData();
