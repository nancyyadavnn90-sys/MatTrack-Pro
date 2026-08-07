const db = require('./config/db');

async function seedMouldingData() {
  console.log('🌱 Seeding Moulding, Moulds, Machines & Job Cards demo data into MySQL...');

  const queryAsync = (sql, params = []) => {
    return new Promise((resolve) => {
      db.query(sql, params, (err, results) => {
        if (err) {
          console.error('SQL Error:', err.message);
          return resolve(null);
        }
        resolve(results);
      });
    });
  };

  // 1. Seed Machines
  await queryAsync(`
    INSERT INTO machines (machine_code, machine_name, capacity_tons, ideal_cycle_time, status)
    VALUES
    ('MCH-01', '200T Hydraulic Press M-01', 200, 5, 'Running'),
    ('MCH-02', '150T Compression Press M-02', 150, 6, 'Running'),
    ('MCH-03', '100T Rubber Press M-03', 100, 4, 'Idle'),
    ('MCH-04', 'Banbury Rubber Mixer M-04', 300, 10, 'Running')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  // 2. Seed Moulds
  await queryAsync(`
    INSERT INTO moulds (mould_code, mould_name, item_id, mould_type, cavities, total_shots_allowed, shots_used, status)
    VALUES
    ('MLD-101', '4-Cavity Engine Grommet Tool', 1, 'Compression', 4, 500000, 14200, 'Available'),
    ('MLD-202', '2-Cavity Hose Tube Die', 2, 'Transfer', 2, 300000, 8500, 'Available'),
    ('MLD-303', '8-Cavity Oil Seal Mold', 3, 'Injection', 8, 600000, 32000, 'In Use')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  // 3. Seed Final Batches
  await queryAsync(`
    INSERT INTO final_batches (fb_number, mb_id, machine_id, operator_id, planned_qty, actual_qty, status)
    VALUES
    ('FB-2026-001', 1, 1, 1, 150, 150, 'Approved'),
    ('FB-2026-002', 1, 2, 1, 200, 200, 'Approved'),
    ('FB-2026-003', 1, 3, 1, 100, 100, 'Approved')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  // 4. Seed Moulding Job Cards
  await queryAsync(`
    INSERT INTO moulding_job_cards (jc_number, wo_id, item_id, customer_id, fb_id, compound_weight_required, mould_id, machine_id, planned_qty, shots_required, moulding_temp, moulding_pressure, curing_time, status)
    VALUES
    ('JC/2026/00001', 1, 1, 1, 1, 45.00, 1, 1, 2000, 500, 165, 150, 4, 'In Progress'),
    ('JC/2026/00002', 2, 2, 2, 2, 30.00, 2, 2, 1500, 750, 160, 145, 5, 'In Progress'),
    ('JC/2026/00003', 3, 3, 3, 3, 60.00, 3, 3, 5000, 625, 170, 160, 3, 'Completed')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  console.log('✅ Moulding Job Cards, Moulds, Machines & Final Batches successfully seeded!');
  process.exit(0);
}

seedMouldingData();
