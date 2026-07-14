const db = require('./db');

const seedTestFlow = async () => {
  const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  };

  try {
    console.log('🌱 Starting comprehensive data seeding across all factory modules...');

    // 1. Disable foreign key checks
    await query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✓ Disabled foreign key checks');

    // 2. Clear existing records for a fresh start
    const tablesToClear = [
      'stages',
      'moulding_production_entries',
      'bom_items',
      'bom',
      'mrn_items',
      'mrn',
      'moulding_job_cards',
      'moulds',
      'final_batches',
      'master_batches',
      'mixing_recipes',
      'dispatch_items',
      'dispatch_orders',
      'stock_positions',
      'fg_receipts',
      'final_qc_inspections',
      'batch_movements',
      'batches',
      'wip_alerts',
      'work_orders',
      'grn_items',
      'grn',
      'gate_passes',
      'customers',
      'suppliers',
      'items',
      'qc_inspections'
    ];
    for (const table of tablesToClear) {
      await query(`DELETE FROM ${table}`);
      await query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
    }
    console.log('✓ Cleared all operational transaction and master tables');

    // 3. Seed 52 Real Customers from Jayashree Polymers' list
    const customerList = [
      ['Renault India', 'REN-IN', 'procurement@renault.in', 'Chennai Plant'],
      ['Nissan India', 'NIS-IN', 'purchase@nissan.in', 'Oragadam Plant'],
      ['Volkswagen India', 'VW-IN', 'procurement@volkswagen.co.in', 'Chakan Pune Plant'],
      ['Honda HMSI', 'HONDA-HMSI', 'purchase@honda-hmsi.com', 'Manesar Plant'],
      ['Tata Motors', 'TATA-MOT', 'procure@tatamotors.com', 'Pune Assembly'],
      ['Isuzu Motors', 'ISUZU-IN', 'procurement@isuzu.co.in', 'Sri City Plant'],
      ['Ford India', 'FORD-IN', 'supply@ford.com', 'Sanand Plant'],
      ['Mahindra & Mahindra', 'M-AND-M', 'purchase@mahindra.com', 'Kandivali Plant'],
      ['Fiat India', 'FIAT-IN', 'purchasing@fiat.co.in', 'Ranjangaon Plant'],
      ['Land Rover India', 'JLR-IN', 'sourcing@jaguarlandrover.com', 'Pune Plant'],
      ['Daimler India', 'DAIMLER-IN', 'logistics@daimler.com', 'Oragadam Plant'],
      ['Ashok Leyland', 'ASHOK-LEY', 'sourcing@ashokleyland.com', 'Ennore Plant'],
      ['MAN Trucks', 'MAN-TRK', 'info@man-trucks.in', 'Pithampur Plant'],
      ['Piaggio Vehicles', 'PIAGGIO-VEH', 'procurement@piaggio.co.in', 'Baramati Plant'],
      ['Force Motors', 'FORCE-MOT', 'procure@forcemotors.com', 'Akurdi Plant'],
      ['Atul Auto', 'ATUL-AUTO', 'purchase@atulauto.co.in', 'Rajkot Plant'],
      ['Hero MotoCorp', 'HERO-MC', 'procurement@heromotocorp.com', 'Gurugram Plant'],
      ['Yamaha Motors', 'YAMAHA-MC', 'logistics@yamaha-motor.co.in', 'Faridabad Plant'],
      ['Suzuki Motorcycle', 'SUZUKI-2W', 'sourcing@suzuki-2wheelers.co.in', 'Gurugram Plant'],
      ['TVS Motor', 'TVS-MOT', 'purchase@tvsmotor.com', 'Hosur Plant'],
      ['JCB India', 'JCB-IN', 'sourcing@jcb.co.in', 'Ballabgarh Plant'],
      ['Volvo India', 'VOLVO-IN', 'purchase@volvo.co.in', 'Bengaluru Plant'],
      ['Caterpillar India', 'CAT-IN', 'sourcing@cat.com', 'Tiruvallur Plant'],
      ['Case Construction', 'CASE-CON', 'purchase@case.co.in', 'Pithampur Plant'],
      ['Mahle India', 'MAHLE-IN', 'procure@mahle.com', 'Gurugram Plant'],
      ['Valeo India', 'VALEO-IN', 'purchase@valeo.co.in', 'Chennai Plant'],
      ['Honeywell India', 'HONEYWELL-IN', 'sourcing@honeywell.com', 'Pune Plant'],
      ['Motori Minarelli', 'MOT-MIN', 'purchase@motoriminarelli.it', 'Bologna Italy'],
      ['South Bend Molding', 'SBM-MD', 'info@southbendmolding.com', 'Indiana USA'],
      ['Senior Flexonics', 'SEN-FLEX', 'sourcing@seniorflexonics.com', 'New Delhi Plant'],
      ['Avtec CK Birla', 'AVTEC-BIRLA', 'procure@avtec.in', 'Pithampur Plant'],
      ['Kohler India', 'KOHLER-IN', 'purchase@kohler.com', 'Jhagadia Plant'],
      ['Cummins India', 'CUMMINS-IN', 'sourcing@cummins.com', 'Pune Plant'],
      ['Cooper Corp', 'COOPER-CORP', 'purchase@coopercorp.in', 'Satara Plant'],
      ['Keihin India', 'KEIHIN-IN', 'procure@keihin.co.in', 'Bawal Plant'],
      ['Spaco Carburetors', 'SPACO-CARB', 'sourcing@spaco.co.in', 'Pune Plant'],
      ['Tata Toyo Radiators', 'TATA-TOYO', 'purchase@tatatoyo.co.in', 'Hinjewadi Plant'],
      ['Subros AC Systems', 'SUBROS', 'procurement@subros.com', 'Noida Plant'],
      ['Dura Automotive', 'DURA-AUTO', 'sourcing@duraauto.com', 'Pune Plant'],
      ['Fleetguard Filters', 'FLEETGUARD', 'purchase@fleetguard-filtrum.com', 'Loni Plant'],
      ['Mann+Hummel', 'MANN-HUMMEL', 'procure@mann-hummel.com', 'Tumkur Plant'],
      ['Donaldson Filtration', 'DONALDSON', 'sourcing@donaldson.com', 'Gurugram Plant'],
      ['CooperStandard', 'COOPER-STD', 'purchase@cooperstandard.com', 'Bawal Plant'],
      ['Delphi Connection', 'DELPHI', 'sourcing@delphi.co.in', 'Chennai Plant'],
      ['Gabriel India', 'GABRIEL', 'sourcing@gabriel.co.in', 'Chakan Plant'],
      ['GE Transportation', 'GE-TRANS', 'procure@ge.com', 'Marhowra Plant'],
      ['Faiveley Transport', 'FAIVELEY', 'purchase@faiveley.com', 'Hosur Plant'],
      ['Wabtec Corp', 'WABTEC', 'sourcing@wabtec.com', 'Baddi Plant'],
      ['Alstom India', 'ALSTOM', 'procure@alstom.com', 'Sri City Plant'],
      ['Philips Healthcare', 'PHILIPS-HC', 'purchase@philips.com', 'Pune Plant'],
      ['Raychem RPG', 'RAYCHEM-RPG', 'sourcing@raychemrpg.com', 'Halol Plant'],
      ['TE Connectivity', 'TE-CONN', 'procure@te.com', 'Bengaluru Plant']
    ];

    for (const c of customerList) {
      await query('INSERT INTO customers (customer_name, customer_code, email, address, status) VALUES (?, ?, ?, ?, \'Active\')', c);
    }
    console.log(`✓ Seeded ${customerList.length} Real Customers`);

    // 4. Seed 10 Real Material Suppliers
    const supplierList = [
      ['Reliance Elastomers', 'Noida UP', 'reliance@elastomers.com'],
      ['Polymer Additives Ltd', 'Gurugram Haryana', 'sales@polymeradditives.com'],
      ['Lanxess Rubber Co', 'Mumbai Maharashtra', 'sourcing@lanxess.com'],
      ['ExxonMobil Synthetics', 'Bengaluru Karnataka', 'chemicals@exxonmobil.com'],
      ['DuPont Polymers', 'Gurugram Haryana', 'polymers@dupont.com'],
      ['BASF Chemical Corp', 'Navi Mumbai', 'info@basf.com'],
      ['Zeon Synthetic Rubber', 'Tokyo Japan', 'sourcing@zeon.co.jp'],
      ['Cabot Carbon Black', 'Chennai Tamil Nadu', 'sales@cabot.com'],
      ['Shin-Etsu Silicones', 'Mumbai Maharashtra', 'silicones@shinetsu.com'],
      ['Jayashree Chemicals', 'Pune Maharashtra', 'info@jayashreechem.com']
    ];

    for (const s of supplierList) {
      const code = s[0].toUpperCase().replace(/\s+/g, '').substring(0, 5) + '-' + Math.floor(Math.random() * 900 + 100);
      await query('INSERT INTO suppliers (supplier_name, supplier_code, address, email, status) VALUES (?, ?, ?, ?, \'Active\')', [s[0], code, s[1], s[2]]);
    }
    console.log(`✓ Seeded ${supplierList.length} Suppliers`);

    // Fetch Suppliers and Customers
    const suppliers = await query('SELECT supplier_id, supplier_name FROM suppliers');
    const customers = await query('SELECT customer_id, customer_name FROM customers');

    // 5. Seed Items (Raw Materials, WIP, and Finished Goods)
    const itemList = [
      [31, 'Door Panel Seal', 'DP-SEAL-01', 'Finished Good', 'Pcs'],
      [32, 'Engine Mount Bushing', 'EM-BUSH-02', 'Finished Good', 'Pcs'],
      [33, 'Radiator Gasket EPDM', 'RAD-GASK-03', 'Finished Good', 'Pcs'],
      [34, 'Fuel Hose Bellow Nitrile', 'FH-BEL-04', 'Finished Good', 'Pcs'],
      [35, 'Oil Seal ring 45mm', 'OS-RING-45', 'Finished Good', 'Pcs'],
      [36, 'Carburetor Diaphragm', 'CARB-DIA-06', 'Finished Good', 'Pcs'],
      [37, 'Wiring Harness Grommet', 'WH-GROM-07', 'Finished Good', 'Pcs'],
      [38, 'Moulded Rubber Buffer', 'RB-BUFF-08', 'Finished Good', 'Pcs'],
      [39, 'Brake Caliper Boot', 'BC-BOOT-09', 'Finished Good', 'Pcs'],
      [40, 'EPDM Compounding Slab', 'EPDM-SLAB-10', 'Semi Finished', 'Kgs'],
      [41, 'Nitrile Compound Slab', 'NBR-SLAB-11', 'Semi Finished', 'Kgs'],
      [42, 'Raw Rubber EPDM 3550', 'EPDM-RAW-01', 'Raw Material', 'Kgs'],
      [43, 'Carbon Black N330', 'CB-N330', 'Raw Material', 'Kgs'],
      [44, 'Paraffinic Process Oil', 'OIL-PAR-02', 'Raw Material', 'Kgs'],
      [45, 'Zinc Oxide Activator', 'ZNO-ACT', 'Raw Material', 'Kgs']
    ];

    for (const item of itemList) {
      await query('INSERT INTO items (item_id, item_name, item_code, category, unit, status) VALUES (?, ?, ?, ?, ?, \'Active\')', item);
    }
    console.log('✓ Seeded Items');

    // 5b. Seed the 6 Mockup stages
    const mockupStages = [
      [1, 'MIXING', 1, 4, '#3b82f6'],
      [2, 'MOULDING', 2, 8, '#22c55e'],
      [3, 'TRIMMING', 3, 4, '#f59e0b'],
      [4, 'FINAL QC', 4, 2, '#a855f7'],
      [5, 'FG STORE', 5, 2, '#14b8a6'],
      [6, 'DISPATCH', 6, 2, '#ef4444']
    ];
    for (const stg of mockupStages) {
      await query(`
        INSERT INTO stages (stage_id, stage_name, stage_order, max_time_hours, color_code)
        VALUES (?, ?, ?, ?, ?)
      `, stg);
    }
    console.log('✓ Seeded 6 Mockup Kanban stages');

    // 6. Seed Mould Master (15 moulds, 12 Available, 2 Under Maintenance, 1 In Use)
    const finishedGoods = [31, 32, 33, 34, 35, 36, 37, 38, 39];
    const mouldTypes = ['Compression', 'Injection', 'Transfer'];
    for (let i = 1; i <= 15; i++) {
      const mouldCode = `MOLD-CODE-${100 + i}`;
      const itemId = finishedGoods[(i - 1) % finishedGoods.length];
      const mouldName = `${itemList.find(item => item[0] === itemId)[1]} Mold Platen #${i}`;
      const status = i === 5 || i === 12 ? 'Under Maintenance' : i === 8 ? 'In Use' : 'Available';
      const cavities = i % 4 === 0 ? 16 : i % 3 === 0 ? 8 : 4;
      const shotsUsed = 12000 + i * 2300;

      await query(`
        INSERT INTO moulds 
          (mould_code, mould_name, item_id, mould_type, cavities, total_shots_allowed, shots_used, mould_material, platen_length, platen_width, platen_height, weight_kg, status)
        VALUES (?, ?, ?, ?, ?, 500000, ?, 'P20 Steel', 500, 500, 180, 240.50, ?)
      `, [mouldCode, mouldName, itemId, mouldTypes[i % mouldTypes.length], cavities, shotsUsed, status]);
    }
    console.log('✓ Seeded 15 Moulds in Mould Master (12 Available, 2 Under Maintenance, 1 In Use)');

    const moulds = await query('SELECT mould_id, mould_code, cavities FROM moulds');

    // 7. Seed 20 Unique Mixing Recipes (RCP0001 to RCP0020)
    const recipesData = [
      ['RCP0001', 'EPDM-70 Base Compound', 'EPDM', 150.00],
      ['RCP0002', 'NBR-40 Oil Resistant Compound', 'NBR', 150.00],
      ['RCP0003', 'EPDM Peroxide Compound', 'EPDM', 200.00],
      ['RCP0004', 'SBR-50 Tire Tread Compound', 'SBR', 200.00],
      ['RCP0005', 'Neoprene Weatherstrip Compound', 'Neoprene', 100.00],
      ['RCP0006', 'Natural Rubber High Tensile Compound', 'Natural Rubber', 100.00],
      ['RCP0007', 'Silicone Heat Resistant Compound', 'Silicone', 120.00],
      ['RCP0008', 'Viton High Temp Seal Compound', 'Viton', 120.00],
      ['RCP0009', 'Nitrile Hose Liner Compound', 'NBR', 250.00],
      ['RCP0010', 'EPDM Sponge Profile Compound', 'EPDM', 250.00],
      ['RCP0011', 'NBR/PVC Blend Jacket Compound', 'NBR', 180.00],
      ['RCP0012', 'Fluoroelastomer FKM Seal Compound', 'Viton', 180.00],
      ['RCP0013', 'Butyl Dampener Inner Tube Compound', 'Butyl', 150.00],
      ['RCP0014', 'Chloroprene Rubber CR-60 Compound', 'Neoprene', 150.00],
      ['RCP0015', 'Polyacrylic Rubber ACM-70 Compound', 'ACM', 160.00],
      ['RCP0016', 'Polyurethane TPU Molded Compound', 'TPU', 160.00],
      ['RCP0017', 'EPDM Cured Cable Insulation Compound', 'EPDM', 200.00],
      ['RCP0018', 'NBR Food Grade Seal Compound', 'NBR', 200.00],
      ['RCP0019', 'Silicone Translucent Tube Compound', 'Silicone', 100.00],
      ['RCP0020', 'Fluorosilicone Aerospace Gasket Compound', 'Fluorosilicone', 100.00]
    ];

    for (const r of recipesData) {
      await query(`
        INSERT INTO mixing_recipes (recipe_code, recipe_name, rubber_type, batch_size, unit, version, status)
        VALUES (?, ?, ?, ?, 'Kg', 'v1', 'Active')
      `, r);
    }
    console.log('✓ Seeded 20 unique rubber compounding recipes in Mixing module');

    const recipes = await query('SELECT recipe_id, recipe_code FROM mixing_recipes');

    // 8. Seed 12 Bills of Materials (BOM) linking Finished Goods to raw ingredients
    for (let i = 0; i < finishedGoods.length; i++) {
      const finishedItemId = finishedGoods[i];
      
      const bom_id = await query(`
        INSERT INTO bom (finished_item_id, version, status, created_by, effective_from)
        VALUES (?, 'v1', 'Active', 1, NOW())
      `, [finishedItemId]);

      // Link Finished Good to Raw Materials (EPDM 42, Carbon Black 43, Process Oil 44)
      await query(`
        INSERT INTO bom_items (bom_id, raw_material_id, quantity, unit, scrap_percent, net_qty_per_unit)
        VALUES 
          (?, 42, 0.450, 'Kgs', 2.00, 0.441),
          (?, 43, 0.150, 'Kgs', 1.00, 0.1485),
          (?, 44, 0.080, 'Kgs', 0.00, 0.080)
      `, [bom_id.insertId, bom_id.insertId, bom_id.insertId]);
    }
    console.log('✓ Seeded 12 Bills of Materials (BOM) & detail lines');

    // 9. Generate 15 Inward Gate Passes
    const gpRows = [];
    const vehicleStates = ['DL', 'HR', 'MH', 'UP'];
    const remarksOptions = ['Raw rubber compound consignment', 'Carbon black sacks delivery', 'Paraffinic oil barrels', 'Zinc oxide boxes'];

    for (let i = 1; i <= 15; i++) {
      const gpNum = `GP/2026/00${100 + i}`;
      const status = i <= 5 ? 'Open' : i <= 10 ? 'GRN Created' : 'Closed';
      const supplier = suppliers[(i - 1) % suppliers.length];
      const vehicleNum = `${vehicleStates[i % 4]}-3C-XY-${1000 + i * 50}`;
      const driver = `Driver Singh #${i}`;
      const remarks = remarksOptions[i % remarksOptions.length];

      gpRows.push([
        gpNum, 'Inward', supplier.supplier_id, null, vehicleNum, driver, remarks, status, 1
      ]);
    }

    await query(`
      INSERT INTO gate_passes 
        (gp_number, gp_type, supplier_id, customer_id, vehicle_number, driver_name, remarks, status, created_by)
      VALUES ?
    `, [gpRows]);
    console.log('✓ Seeded 15 Gate Passes');

    const createdGPs = await query('SELECT gp_id, gp_number, supplier_id FROM gate_passes ORDER BY gp_id ASC');

    // 10. Generate 15 Goods Receipt Notes (GRN)
    // - To show Raw Material Stock: 8 items are put away with bin codes and showing up in Stock positions.
    // - To show Pending Put-Away: 4 items are left with bin = null and status = Available.
    // - To show Inward QC Queue: 3 items are left with bin = null and status = QC Pending.
    for (let i = 0; i < createdGPs.length; i++) {
      const grnNum = `GRN/2026/00${101 + i}`;
      const gp = createdGPs[i];
      const invVal = 25000.00 + i * 3200.50;
      
      // Seed 3 QC Pending items, others Completed/Draft
      const status = i < 3 ? 'Submitted' : i < 8 ? 'Draft' : 'Completed';
      const grn_id = await query(`
        INSERT INTO grn 
          (grn_number, gp_id, supplier_id, grn_date, invoice_number, invoice_value, store_id, remarks, status, created_by, qc_required)
        VALUES (?, ?, ?, NOW(), ?, ?, 1, ?, ?, 1, 'Yes')
      `, [grnNum, gp.gp_id, gp.supplier_id, `INV-AB-${700 + i}`, invVal, `GRN linked to GP ${gp.gp_number}`, status]);

      // Items range EPDM 42, Carbon Black 43, Process Oil 44
      const rawItemIds = [42, 43, 44, 45];
      const rawItem = rawItemIds[i % rawItemIds.length];
      const qty = 600.00 + i * 110.50;
      
      // 3 items (i < 3) -> status = 'QC Pending' (shows in Inward QC queue!)
      // 4 items (3 <= i < 7) -> status = 'Available', bin = NULL (shows in Pending Put-Away!)
      // 8 items (i >= 7) -> status = 'Available', bin = 'BIN-A1' (shows in Balance Stock positions!)
      const itemStatus = i < 3 ? 'QC Pending' : 'Available';
      const bin = i >= 7 ? `BIN-R${i}` : null;

      await query(`
        INSERT INTO grn_items 
          (grn_id, item_id, ordered_qty, received_qty, accepted_qty, unit, batch_number, bin, status)
        VALUES (?, ?, ?, ?, ?, 'Kgs', ?, ?, ?)
      `, [grn_id.insertId, rawItem, qty + 50, qty, qty, `RAW-BATCH-${101 + i}`, bin, itemStatus]);

      // If put away (bin set), add stock position in Raw Material Store (store 1)
      if (bin) {
        await query(`
          INSERT INTO stock_positions (store_id, item_id, current_qty, last_updated)
          VALUES (1, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE current_qty = current_qty + VALUES(current_qty)
        `, [rawItem, qty]);
      }
    }
    console.log('✓ Seeded 15 GRNs: 3 in Inward QC, 4 in Pending Put-Aways, 8 in Balance Stock positions!');

    // 11. Generate 15 Work Orders
    const woRows = [];
    for (let i = 1; i <= 15; i++) {
      const woNum = `WO/2026/00${100 + i}`;
      const itemId = finishedGoods[(i - 1) % finishedGoods.length];
      const customer = customers[(i - 1) % customers.length];
      const plannedQty = 800 + i * 250;
      const status = i <= 4 ? 'Released' : i <= 11 ? 'In Progress' : 'Completed';
      const producedQty = status === 'Completed' ? plannedQty : status === 'In Progress' ? Math.round(plannedQty * 0.35) : 0;
      const actualEnd = status === 'Completed' ? new Date() : null;

      // Seed planned start/end dates
      const plannedStart = new Date();
      plannedStart.setDate(plannedStart.getDate() - 2);
      const plannedEnd = new Date();
      plannedEnd.setDate(plannedEnd.getDate() + 5 + i);

      woRows.push([
        woNum, itemId, plannedQty, producedQty, status, customer.customer_id, 1, actualEnd, plannedStart, plannedEnd
      ]);
    }

    await query(`
      INSERT INTO work_orders 
        (wo_number, item_id, planned_qty, produced_qty, status, customer_id, created_by, actual_end, planned_start, planned_end)
      VALUES ?
    `, [woRows]);
    console.log('✓ Seeded 15 Work Orders with planned dates');

    const createdWOs = await query('SELECT wo_id, wo_number, item_id, planned_qty, customer_id FROM work_orders ORDER BY wo_id ASC');

    // 12. Seed 12 Material Requisition Notes (MRN) linked to WOs
    for (let i = 0; i < 12; i++) {
      const wo = createdWOs[i];
      const mrnNum = `MRN/2026/00${101 + i}`;
      const status = i % 3 === 0 ? 'Pending' : i % 3 === 1 ? 'Partially Issued' : 'Issued';

      const mrn_id = await query(`
        INSERT INTO mrn (mrn_number, wo_id, requested_by, status, request_date, required_by_date, remarks)
        VALUES (?, ?, 1, ?, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'Compounding raw materials request')
      `, [mrnNum, wo.wo_id, status]);

      // Add items
      await query(`
        INSERT INTO mrn_items (mrn_id, item_id, required_qty, issued_qty, unit)
        VALUES 
          (?, 42, 120.00, ?, 'Kgs'),
          (?, 43, 50.00, ?, 'Kgs')
      `, [mrn_id.insertId, status === 'Issued' ? 120.00 : 0.00, mrn_id.insertId, status === 'Issued' ? 50.00 : 0.00]);
    }
    console.log('✓ Seeded 12 Material Requisition Notes (MRN) & details');

    // 13. Seed 7 More Master Batches (total 15 master batches) in Mixing
    // Adding realistic Banbury compound mixing parameters
    for (let i = 0; i < createdWOs.length; i++) {
      const wo = createdWOs[i];
      const mbNum = `MB-MIX-${101 + i}`;
      const recipe = recipes[i % recipes.length];
      const status = i <= 2 ? 'Pending' : i <= 6 ? 'Lab Pending' : 'Approved';
      const actualQty = 150.00 + i * 10;
      const dropTemp = 105 + (i % 5) * 2;
      const viscosity = 55.4 + (i % 4) * 1.5;

      await query(`
        INSERT INTO master_batches 
          (mb_number, recipe_id, machine_id, operator_id, planned_qty, actual_qty, mix_time, drop_temp, ram_pressure, rotor_speed, chamber_temp, start_time, end_time, status, barcode, fill_factor, power_consumption, mixing_temp)
        VALUES (?, ?, 1, 1, ?, ?, 5.5, ?, 4.5, 40, 85, NOW(), NOW(), ?, ?, 0.72, 450.50, ?)
      `, [mbNum, recipe.recipe_id, actualQty + 20, actualQty, dropTemp, status, `MB-BAR-${101 + i}`, dropTemp - 5]);
    }
    console.log('✓ Seeded 15 Master Batches in Compounding Log (Mixing)');

    const masterBatches = await query('SELECT mb_id, mb_number, recipe_id FROM master_batches');

    // 14. Seed Final Batches
    for (let i = 0; i < masterBatches.length; i++) {
      const mb = masterBatches[i];
      const fbNum = `FB-MIX-${101 + i}`;
      const status = i < 10 ? 'Approved' : 'Pending';

      await query(`
        INSERT INTO final_batches 
          (fb_number, mb_id, machine_id, operator_id, planned_qty, actual_qty, mix_time, drop_temp, mooney_viscosity, start_time, end_time, status, barcode, item_id)
        VALUES (?, ?, 2, 1, 150.00, 148.50, 4.2, 102.5, 52.5, NOW(), NOW(), ?, ?, 40)
      `, [fbNum, mb.mb_id, status, `FB-BAR-${101 + i}`]);
    }
    console.log('✓ Seeded 15 Final Compound Batches');

    const finalBatches = await query('SELECT fb_id, fb_number FROM final_batches');

    // 15. Seed 12 Moulding Job Cards (Moulding)
    // Linking final compounds, WOs, moulds and machines
    for (let i = 0; i < 12; i++) {
      const wo = createdWOs[i];
      const fb = finalBatches[i % finalBatches.length];
      const mould = moulds[i % moulds.length];
      const jcNum = `JC/2026/00${101 + i}`;
      const status = i < 4 ? 'Pending' : i < 9 ? 'Running' : 'Completed';
      const plannedStart = `DATE_SUB(NOW(), INTERVAL ${12 - i} HOUR)`;
      const plannedEnd = `DATE_ADD(NOW(), INTERVAL ${i + 2} HOUR)`;

      const jc_id = await query(`
        INSERT INTO moulding_job_cards 
          (jc_number, wo_id, item_id, customer_id, fb_id, compound_weight_required, mould_id, machine_id, planned_qty, shots_required, status, planned_start, planned_end)
        VALUES (?, ?, ?, ?, ?, 80.500, ?, 9, ?, ?, ?, ${plannedStart}, ${plannedEnd})
      `, [jcNum, wo.wo_id, wo.item_id, wo.customer_id, fb.fb_id, mould.mould_id, wo.planned_qty, Math.round(wo.planned_qty / mould.cavities), status]);

      // If job card is completed or running, insert live production stats for today
      if (status === 'Completed' || status === 'Running') {
        const shots = Math.round(wo.planned_qty / mould.cavities);
        const good = status === 'Completed' ? wo.planned_qty : Math.round(wo.planned_qty * 0.35);
        const rejected = Math.round(good * 0.03); // 3% reject rate

        await query(`
          INSERT INTO moulding_production_entries 
            (jc_id, machine_id, operator_id, shift, entry_date, shots_completed, good_parts, rejected_parts, downtime_minutes, downtime_reason, remarks)
          VALUES (?, 9, 1, 'A', NOW(), ?, ?, ?, 12, 'Regular hourly run', 'Seeded production metric log')
        `, [jc_id.insertId, shots, good, rejected]);
      }
    }
    console.log('✓ Seeded 12 Moulding Job Cards & matching moulding_production_entries');

    // 16. Seed 15 WIP Batches for Kanban Board
    const operators = ['Ramesh Kumar', 'Suresh Patel', 'Anil Sharma', 'Vikram Yadav', 'Sunil Dutt'];
    const statuses = ['Normal', 'Slow', 'Stuck', 'QC Hold', 'Normal', 'Rework'];

    for (let i = 0; i < createdWOs.length; i++) {
      const wo = createdWOs[i];
      const batchNum = `B/2026/00${101 + i}`;
      const stageId = (i % 6) + 1;
      const batchStatus = statuses[i % statuses.length];
      const qty = Math.round(wo.planned_qty / 2.5);

      const batch_id = await query(`
        INSERT INTO batches 
          (batch_number, wo_id, item_id, machine_id, quantity, current_stage_id, status, created_by, batch_type, created_at)
        VALUES (?, ?, ?, 9, ?, ?, ?, 1, 'Master', DATE_SUB(NOW(), INTERVAL ? HOUR))
      `, [batchNum, wo.wo_id, wo.item_id, qty, stageId, batchStatus, i * 2]);

      // Seed movements
      for (let s = 1; s <= stageId; s++) {
        const isCurrent = s === stageId;
        const entered = `DATE_SUB(NOW(), INTERVAL ${(stageId - s + 1) * 4} HOUR)`;
        const exited = isCurrent ? 'NULL' : `DATE_SUB(NOW(), INTERVAL ${(stageId - s) * 4} HOUR)`;
        const duration = isCurrent ? 'NULL' : '240';

        await query(`
          INSERT INTO batch_movements 
            (batch_id, stage_id, entered_at, exited_at, duration_minutes, moved_by, remarks)
          VALUES (?, ?, ${entered}, ${exited}, ${duration}, 1, 'Moulding supervisor dispatch log')
        `, [batch_id.insertId, s]);
      }
    }
    console.log('✓ Seeded 15 WIP Batches & Movements timelines');

    // 17. Seed 15 Final QC Inspections
    const qcResults = ['Approved', 'Rejected', 'On Hold', 'Approved', 'Approved'];
    for (let i = 0; i < createdWOs.length; i++) {
      const wo = createdWOs[i];
      const fqcNum = `FQC/2026/00${101 + i}`;
      const result = qcResults[i % qcResults.length];
      const inspected = Math.round(wo.planned_qty * 0.4);
      const accepted = result === 'Approved' ? inspected : result === 'On Hold' ? Math.round(inspected * 0.8) : 0;
      const rejected = inspected - accepted;

      await query(`
        INSERT INTO final_qc_inspections 
          (fqc_number, inspection_id, wo_id, item_id, inspected_qty, accepted_qty, rejected_qty, result, inspected_by, inspection_date, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), 'Quality gate check metrics')
      `, [fqcNum, i + 1, wo.wo_id, wo.item_id, inspected, accepted, rejected, result]);
    }
    console.log('✓ Seeded 15 Final QC Inspections');

    const approvedQCs = await query('SELECT * FROM final_qc_inspections WHERE result = \'Approved\' ORDER BY fqc_id ASC');

    // 18. Seed FG Receipts
    for (let i = 0; i < approvedQCs.length; i++) {
      const qc = approvedQCs[i];
      const fgrNum = `FGR/2026/00${101 + i}`;

      await query(`
        INSERT INTO fg_receipts 
          (fgr_number, wo_id, item_id, received_qty, store_id, receipt_date, qc_status, created_by, status)
        VALUES (?, ?, ?, ?, 3, NOW(), 'Passed', 1, 'Received')
      `, [fgrNum, qc.wo_id, qc.item_id, qc.accepted_qty]);

      await query(`
        INSERT INTO stock_positions (store_id, item_id, current_qty, last_updated)
        VALUES (3, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE current_qty = current_qty + VALUES(current_qty)
      `, [qc.item_id, qc.accepted_qty]);
    }
    console.log('✓ Seeded FG Receipts and FG Store stock balance');

    // 19. Seed 15 Dispatch Orders
    const transporters = ['Delhi Cargo', 'Ramesh Transport', 'VRL Logistics', 'Safexpress'];
    const doStatuses = ['Draft', 'Dispatched', 'Delivered'];

    for (let i = 0; i < createdWOs.length; i++) {
      const wo = createdWOs[i];
      const doNum = `DO/2026/00${101 + i}`;
      const status = doStatuses[i % doStatuses.length];
      const transporter = transporters[i % transporters.length];
      const vehicle = `${vehicleStates[i % 4]}-3C-D-${4000 + i * 70}`;
      const driver = `Driver Kumar #${i}`;
      const qty = Math.round(wo.planned_qty * 0.2);

      const do_id = await query(`
        INSERT INTO dispatch_orders 
          (do_number, customer_id, dispatch_date, vehicle_number, driver_name, transporter, status, created_by)
        VALUES (?, ?, NOW(), ?, ?, ?, ?, 1)
      `, [doNum, wo.customer_id, vehicle, driver, transporter, status]);

      const fgrBarcode = approvedQCs.length > 0
        ? approvedQCs[i % approvedQCs.length].fqc_number.replace('FQC', 'FGR')
        : 'FGR/2026/00101';

      await query(`
        INSERT INTO dispatch_items (do_id, item_id, wo_id, fgr_number, qty)
        VALUES (?, ?, ?, ?, ?)
      `, [do_id.insertId, wo.item_id, wo.wo_id, fgrBarcode, qty]);
    }
    console.log('✓ Seeded 15 Dispatch Orders');

    // 20. Re-enable foreign key checks
    await query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Re-enabled foreign key checks');
    console.log('🌱 Data seeding completed successfully! All factory modules have fully configured operational data.');
    process.exit(0);

  } catch (err) {
    console.error('❌ Data seeding failed:', err);
    process.exit(1);
  }
};

seedTestFlow();
