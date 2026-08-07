const db = require('./config/db');

async function seedMouldingData() {
  console.log('🌱 Seeding Moulding, Moulds, Machines, QC & Job Cards demo data into MySQL...');

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

  // Get valid item_id and customer_id dynamically
  const itemRows = await queryAsync('SELECT item_id FROM items LIMIT 3');
  const item1 = itemRows?.[0]?.item_id || 31;
  const item2 = itemRows?.[1]?.item_id || 32;
  const item3 = itemRows?.[2]?.item_id || 33;

  const custRows = await queryAsync('SELECT customer_id FROM customers LIMIT 3');
  const cust1 = custRows?.[0]?.customer_id || 1;
  const cust2 = custRows?.[1]?.customer_id || 2;
  const cust3 = custRows?.[2]?.customer_id || 3;

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
    ('MLD-101', '4-Cavity Engine Grommet Tool', ${item1}, 'Compression', 4, 500000, 14200, 'Available'),
    ('MLD-202', '2-Cavity Hose Tube Die', ${item2}, 'Transfer', 2, 300000, 8500, 'Available'),
    ('MLD-303', '8-Cavity Oil Seal Mold', ${item3}, 'Injection', 8, 600000, 32000, 'In Use')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  // Fetch valid mould_id and machine_id
  const mouldRows = await queryAsync('SELECT mould_id FROM moulds LIMIT 3');
  const mld1 = mouldRows?.[0]?.mould_id || 1;
  const mld2 = mouldRows?.[1]?.mould_id || 2;
  const mld3 = mouldRows?.[2]?.mould_id || 3;

  const macRows = await queryAsync('SELECT machine_id FROM machines LIMIT 3');
  const mac1 = macRows?.[0]?.machine_id || 1;
  const mac2 = macRows?.[1]?.machine_id || 2;
  const mac3 = macRows?.[2]?.machine_id || 3;

  // 3. Seed Final Batches
  await queryAsync(`
    INSERT INTO final_batches (fb_number, mb_id, machine_id, operator_id, planned_qty, actual_qty, status)
    VALUES
    ('FB-2026-001', 1, ${mac1}, 1, 150, 150, 'Approved'),
    ('FB-2026-002', 1, ${mac2}, 1, 200, 200, 'Approved'),
    ('FB-2026-003', 1, ${mac3}, 1, 100, 100, 'Approved')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  const fbRows = await queryAsync('SELECT fb_id FROM final_batches LIMIT 3');
  const fb1 = fbRows?.[0]?.fb_id || 1;
  const fb2 = fbRows?.[1]?.fb_id || 2;
  const fb3 = fbRows?.[2]?.fb_id || 3;

  const woRows = await queryAsync('SELECT wo_id FROM work_orders LIMIT 3');
  const wo1 = woRows?.[0]?.wo_id || 1;
  const wo2 = woRows?.[1]?.wo_id || 2;
  const wo3 = woRows?.[2]?.wo_id || 3;

  // 4. Seed Moulding Job Cards
  await queryAsync(`
    INSERT INTO moulding_job_cards (jc_number, wo_id, item_id, customer_id, fb_id, compound_weight_required, mould_id, machine_id, planned_qty, shots_required, moulding_temp, moulding_pressure, curing_time, status)
    VALUES
    ('JC/2026/00001', ${wo1}, ${item1}, ${cust1}, ${fb1}, 45.00, ${mld1}, ${mac1}, 2000, 500, 165, 150, 4, 'In Progress'),
    ('JC/2026/00002', ${wo2}, ${item2}, ${cust2}, ${fb2}, 30.00, ${mld2}, ${mac2}, 1500, 750, 160, 145, 5, 'In Progress'),
    ('JC/2026/00003', ${wo3}, ${item3}, ${cust3}, ${fb3}, 60.00, ${mld3}, ${mac3}, 5000, 625, 170, 160, 3, 'Completed')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `);

  // 5. Seed QC Inspections
  await queryAsync(`
    INSERT INTO qc_inspections (inspection_number, inspection_type, item_id, inspected_qty, accepted_qty, rejected_qty, result)
    VALUES
    ('QC-2026-001', 'Inward', ${item1}, 200, 198, 2, 'Accepted'),
    ('QC-2026-002', 'Final', ${item2}, 150, 140, 10, 'Pending'),
    ('QC-2026-003', 'Final', ${item3}, 200, 195, 5, 'Accepted')
    ON DUPLICATE KEY UPDATE result = VALUES(result)
  `);

  console.log('✅ Moulding Job Cards, Moulds, Machines, Final Batches & QC Inspections successfully seeded with valid FKs!');
  process.exit(0);
}

seedMouldingData();
