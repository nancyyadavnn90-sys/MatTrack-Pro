const db = require('./db');

const runMigration = async () => {
  const executeQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  };

  try {
    console.log('Starting WIP Kanban database migrations...');

    // 1. Temporarily disable foreign key checks to perform cleanups
    await executeQuery('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✓ Disabled foreign key checks');

    // 2. Alter batches status enum to support 'Rework' and 'Normal'
    await executeQuery(`
      ALTER TABLE batches 
      MODIFY COLUMN status ENUM('In Progress','Normal','Slow','Stuck','QC Hold','Completed','Approved','Rejected','Rework') 
      DEFAULT 'In Progress'
    `);
    console.log('✓ Updated batches status enum');

    // 3. Clear and re-populate stages with explicit stage_id
    await executeQuery('DELETE FROM stages');
    console.log('✓ Cleared old stages');

    const stagesSeed = [
      [1, 'Compounding/Mixing', 1, 2, '#8B5CF6'],
      [2, 'Moulding', 2, 3, '#3B82F6'],
      [3, 'Curing', 3, 4, '#F59E0B'],
      [4, 'Trimming/Deflashing', 4, 2, '#10B981'],
      [5, 'Inspection/QC', 5, 2, '#EF4444'],
      [6, 'Packaging', 6, 1, '#EC4899'],
      [7, 'Finished Goods', 7, 0, '#6B7280']
    ];

    await executeQuery(
      'INSERT INTO stages (stage_id, stage_name, stage_order, max_time_hours, color_code) VALUES ?',
      [stagesSeed]
    );
    console.log('✓ Seeded 7 standard factory stages');

    // 4. Create wip_alerts table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS wip_alerts (
        alert_id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id INT NOT NULL,
        stage_id INT NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        alert_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        acknowledged_by INT DEFAULT NULL,
        acknowledged_at DATETIME DEFAULT NULL,
        resolved_by INT DEFAULT NULL,
        resolved_at DATETIME DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE,
        FOREIGN KEY (stage_id) REFERENCES stages(stage_id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created wip_alerts table');

    // 5. Re-enable foreign key checks
    await executeQuery('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Re-enabled foreign key checks');
    console.log('WIP Kanban database migration completed successfully!');
    process.exit(0);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

runMigration();
