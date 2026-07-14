const db = require('../config/db');
const { updateStock } = require('../config/stockHelper');

// ─── PART 1: RECIPE MANAGEMENT ────────────────────────────────────────

// GET all recipes
exports.getRecipes = (req, res) => {
  const sql = `SELECT * FROM mixing_recipes ORDER BY recipe_code ASC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve recipes', error: err.message });
    res.json(results);
  });
};

// GET single recipe with all ingredients
exports.getRecipeById = (req, res) => {
  const { id } = req.params;
  const recipeSql = `SELECT * FROM mixing_recipes WHERE recipe_id = ?`;
  
  db.query(recipeSql, [id], (err, recipeRows) => {
    if (err) return res.status(500).json({ message: 'Error retrieving recipe', error: err.message });
    if (recipeRows.length === 0) return res.status(404).json({ message: 'Recipe not found' });

    const ingredientsSql = `
      SELECT 
        ri.*,
        i.item_code as material_code,
        i.item_name as material_name,
        i.unit as material_unit,
        COALESCE(sp.current_qty, 0) as stock_qty
      FROM mixing_recipe_items ri
      JOIN items i ON ri.raw_material_id = i.item_id
      LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 1
      WHERE ri.recipe_id = ?
    `;

    db.query(ingredientsSql, [id], (err2, ingredientsRows) => {
      if (err2) return res.status(500).json({ message: 'Error retrieving ingredients', error: err2.message });
      res.json({
        recipe: recipeRows[0],
        ingredients: ingredientsRows
      });
    });
  });
};

// POST create new recipe
exports.createRecipe = (req, res) => {
  const { recipe_name, rubber_type, batch_size, unit, ingredients } = req.body;

  if (!recipe_name || !rubber_type || !batch_size || !ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ message: 'Missing recipe parameters.' });
  }

  // Auto-generate recipe code: RCP0001, RCP0002...
  db.query('SELECT COUNT(*) as count FROM mixing_recipes', (err, countResult) => {
    if (err) return res.status(500).json({ message: 'Database lookup error', error: err.message });
    
    const count = countResult[0].count + 1;
    const recipe_code = `RCP${String(count).padStart(4, '0')}`;

    db.beginTransaction((transactionErr) => {
      if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

      const recipeSql = `
        INSERT INTO mixing_recipes (recipe_code, recipe_name, rubber_type, batch_size, unit, version, status)
        VALUES (?, ?, ?, ?, ?, 'v1', 'Active')
      `;

      db.query(recipeSql, [recipe_code, recipe_name, rubber_type, batch_size, unit || 'Kg'], (err2, insertRes) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Recipe insert failed', error: err2.message }));
        }

        const recipe_id = insertRes.insertId;
        const itemSql = `INSERT INTO mixing_recipe_items (recipe_id, raw_material_id, quantity, unit) VALUES ?`;
        const itemValues = ingredients.map(ing => [
          recipe_id,
          ing.raw_material_id,
          ing.quantity,
          ing.unit || 'Kg'
        ]);

        db.query(itemSql, [itemValues], (err3) => {
          if (err3) {
            return db.rollback(() => res.status(500).json({ message: 'Ingredients insert failed', error: err3.message }));
          }

          db.commit((commitErr) => {
            if (commitErr) {
              return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
            }
            res.status(201).json({ message: 'Recipe created successfully', recipe_id, recipe_code });
          });
        });
      });
    });
  });
};

// PUT update recipe (creates new version)
exports.updateRecipe = (req, res) => {
  const { id } = req.params;
  const { recipe_name, rubber_type, batch_size, unit, ingredients } = req.body;

  db.query('SELECT * FROM mixing_recipes WHERE recipe_id = ?', [id], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ message: 'Recipe not found' });
    const oldRecipe = rows[0];

    // Increment version, e.g. v1 -> v2
    const currentVer = parseInt(oldRecipe.version.replace('v', '')) || 1;
    const newVersion = `v${currentVer + 1}`;

    db.beginTransaction((transactionErr) => {
      if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

      // 1. Deactivate old version
      db.query("UPDATE mixing_recipes SET status = 'Inactive' WHERE recipe_id = ?", [id], (err2) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Deactivation failed', error: err2.message }));
        }

        // 2. Insert new version
        const insertSql = `
          INSERT INTO mixing_recipes (recipe_code, recipe_name, rubber_type, batch_size, unit, version, status)
          VALUES (?, ?, ?, ?, ?, ?, 'Active')
        `;
        db.query(insertSql, [oldRecipe.recipe_code, recipe_name || oldRecipe.recipe_name, rubber_type || oldRecipe.rubber_type, batch_size || oldRecipe.batch_size, unit || oldRecipe.unit, newVersion], (err3, insertRes) => {
          if (err3) {
            return db.rollback(() => res.status(500).json({ message: 'New version insert failed', error: err3.message }));
          }

          const newRecipeId = insertRes.insertId;
          const ingredientsSql = `INSERT INTO mixing_recipe_items (recipe_id, raw_material_id, quantity, unit) VALUES ?`;
          const itemValues = ingredients.map(ing => [
            newRecipeId,
            ing.raw_material_id,
            ing.quantity,
            ing.unit || 'Kg'
          ]);

          db.query(ingredientsSql, [itemValues], (err4) => {
            if (err4) {
              return db.rollback(() => res.status(500).json({ message: 'New ingredients insert failed', error: err4.message }));
            }

            db.commit((commitErr) => {
              if (commitErr) {
                return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
              }
              res.json({ message: 'Recipe updated to new version', recipe_id: newRecipeId, version: newVersion });
            });
          });
        });
      });
    });
  });
};

// GET recipe versions
exports.getRecipeVersions = (req, res) => {
  const { code } = req.params;
  const sql = `SELECT * FROM mixing_recipes WHERE recipe_code = ? ORDER BY version DESC`;
  db.query(sql, [code], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve versions', error: err.message });
    res.json(results);
  });
};


// ─── PART 2: MASTER BATCH ──────────────────────────────────────────────

// GET all master batches list
exports.getMasterBatches = (req, res) => {
  const sql = `
    SELECT 
      mb.*,
      r.recipe_name,
      r.recipe_code,
      m.machine_code,
      m.machine_name,
      u.name as operator_name
    FROM master_batches mb
    JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
    LEFT JOIN machines m ON mb.machine_id = m.machine_id
    LEFT JOIN users u ON mb.operator_id = u.user_id
    ORDER BY mb.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve master batches', error: err.message });
    res.json(results);
  });
};

// POST create master batch
exports.createMasterBatch = (req, res) => {
  const { recipe_id, machine_id, operator_id, planned_qty, wo_id } = req.body;

  if (!recipe_id || !machine_id || !operator_id || !planned_qty) {
    return res.status(400).json({ message: 'Missing Master Batch creation parameters.' });
  }

  // Count existing Master Batches to format unique number: MB/2026/00001
  db.query("SELECT COUNT(*) as count FROM master_batches", (err, countResult) => {
    if (err) return res.status(500).json({ message: 'Database lookup error', error: err.message });
    
    const count = countResult[0].count + 1;
    const year = new Date().getFullYear();
    const mb_number = `MB/${year}/${String(count).padStart(5, '0')}`;

    db.beginTransaction((transactionErr) => {
      if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

      const insertBatchSql = `
        INSERT INTO master_batches (mb_number, recipe_id, machine_id, operator_id, planned_qty, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
      `;

      db.query(insertBatchSql, [mb_number, recipe_id, machine_id, operator_id, planned_qty], (err2, insertRes) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Master Batch insert failed', error: err2.message }));
        }

        const mb_id = insertRes.insertId;

        // Fetch recipe items to calculate material requirements based on planned batch size
        const itemsSql = `SELECT * FROM mixing_recipe_items WHERE recipe_id = ?`;
        db.query(itemsSql, [recipe_id], (err3, recipeItems) => {
          if (err3 || recipeItems.length === 0) {
            return db.rollback(() => res.status(500).json({ message: 'Failed to load recipe details', error: err3?.message }));
          }

          // In standard formulation, EPDM is mixed with Carbon, oils etc.
          // Filter recipe ingredients: Master ingredients = anything that is NOT sulfur/accelerators (TMTD/CBS/Sulfur)
          // Sulfur/CBS/TMTD curatives are only issued in the Final Batch.
          // For Master Batch, we filter them out!
          const curativeKeywords = ['sulfur', 'cbs', 'tmtd', 'mbts', 'peroxide', 'dcp', 'accelerator'];
          
          db.query("SELECT item_id, item_name FROM items", (err4, itemsList) => {
            if (err4) {
              return db.rollback(() => res.status(500).json({ message: 'Failed to load items master', error: err4.message }));
            }

            const masterMaterials = recipeItems.filter(ri => {
              const itemName = itemsList.find(it => it.item_id === ri.raw_material_id)?.item_name?.toLowerCase() || '';
              return !curativeKeywords.some(keyword => itemName.includes(keyword));
            });

            // Calculate scaled requirements
            const materialValues = masterMaterials.map(ri => {
              const reqQty = (parseFloat(ri.quantity) / 100) * planned_qty; // scaled quantity
              return [mb_id, ri.raw_material_id, reqQty];
            });

            if (materialValues.length === 0) {
              return db.rollback(() => res.status(400).json({ message: 'No Master Batch ingredients found in recipe.' }));
            }

            const insertMaterialsSql = `INSERT INTO master_batch_materials (mb_id, item_id, required_qty) VALUES ?`;
            db.query(insertMaterialsSql, [materialValues], (err5) => {
              if (err5) {
                return db.rollback(() => res.status(500).json({ message: 'Master materials insert failed', error: err5.message }));
              }

              db.commit((commitErr) => {
                if (commitErr) {
                  return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                }
                res.status(201).json({ message: 'Master Batch created', mb_id, mb_number });
              });
            });
          });
        });
      });
    });
  });
};

// GET single master batch detail
exports.getMasterBatchById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      mb.*,
      r.recipe_name,
      r.recipe_code,
      m.machine_code,
      m.machine_name,
      u.name as operator_name
    FROM master_batches mb
    JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
    LEFT JOIN machines m ON mb.machine_id = m.machine_id
    LEFT JOIN users u ON mb.operator_id = u.user_id
    WHERE mb.mb_id = ?
  `;

  db.query(sql, [id], (err, batchRows) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve batch', error: err.message });
    if (batchRows.length === 0) return res.status(404).json({ message: 'Batch not found' });

    const materialsSql = `
      SELECT 
        mbm.*,
        i.item_code as material_code,
        i.item_name as material_name,
        i.unit as material_unit,
        COALESCE(sp.current_qty, 0) as stock_qty
      FROM master_batch_materials mbm
      JOIN items i ON mbm.item_id = i.item_id
      LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 1
      WHERE mbm.mb_id = ?
    `;

    db.query(materialsSql, [id], (err2, materialRows) => {
      if (err2) return res.status(500).json({ message: 'Failed to retrieve materials', error: err2.message });
      res.json({
        batch: batchRows[0],
        materials: materialRows
      });
    });
  });
};

// PUT start master batch (issue materials and start timer)
exports.startMasterBatch = (req, res) => {
  const { id } = req.params;

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    // Fetch batch number and ingredients
    db.query("SELECT mb_number, operator_id FROM master_batches WHERE mb_id = ?", [id], (err, batchRows) => {
      if (err || batchRows.length === 0) {
        return db.rollback(() => res.status(404).json({ message: 'Batch not found' }));
      }
      const { mb_number, operator_id } = batchRows[0];

      db.query("SELECT * FROM master_batch_materials WHERE mb_id = ?", [id], async (err2, materials) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Materials fetch failed', error: err2.message }));
        }

        try {
          // Check stock and issue materials
          for (const m of materials) {
            // Auto issue: set issued_qty = required_qty and deduct stock
            await updateStock(
              db,
              m.item_id,
              1, // Store 1: Raw Material Store
              -m.required_qty, // deduct
              'Issue',
              mb_number,
              operator_id
            );
          }

          // Update issued quantity in master_batch_materials
          await new Promise((resolve, reject) => {
            db.query("UPDATE master_batch_materials SET issued_qty = required_qty WHERE mb_id = ?", [id], (err3) => {
              if (err3) return reject(err3);
              resolve();
            });
          });

          // Set status and start_time
          await new Promise((resolve, reject) => {
            db.query("UPDATE master_batches SET status = 'In Progress', start_time = NOW() WHERE mb_id = ?", [id], (err4) => {
              if (err4) return reject(err4);
              resolve();
            });
          });

          db.commit((commitErr) => {
            if (commitErr) {
              return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
            }
            res.json({ message: 'Master Batch started. Materials issued and stock deducted successfully!' });
          });

        } catch (execErr) {
          db.rollback(() => res.status(500).json({ message: 'Failed to start batch: ' + execErr.message }));
        }
      });
    });
  });
};

// PUT add mixing parameters (during compounding run)
exports.addMasterParameters = (req, res) => {
  const { id } = req.params;
  const { mix_time, drop_temp, ram_pressure, rotor_speed, chamber_temp } = req.body;

  const sql = `
    UPDATE master_batches 
    SET 
      mix_time = ?, 
      drop_temp = ?, 
      ram_pressure = ?, 
      rotor_speed = ?, 
      chamber_temp = ?
    WHERE mb_id = ?
  `;

  db.query(sql, [mix_time, drop_temp, ram_pressure, rotor_speed, chamber_temp, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to log mixing parameters', error: err.message });
    res.json({ message: 'Mixing parameters saved.' });
  });
};

// PUT complete master batch
exports.completeMasterBatch = (req, res) => {
  const { id } = req.params;
  const { actual_qty, mix_time, drop_temp, ram_pressure, rotor_speed, chamber_temp, fill_factor, power_consumption, mixing_temp } = req.body;

  if (!actual_qty) {
    return res.status(400).json({ message: 'Actual discharge output weight is required.' });
  }

  db.query("SELECT mb_number FROM master_batches WHERE mb_id = ?", [id], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ message: 'Batch not found' });
    const mb_number = rows[0].mb_number;

    const sql = `
      UPDATE master_batches 
      SET 
        status = 'Completed', 
        end_time = NOW(), 
        actual_qty = ?, 
        mix_time = COALESCE(?, mix_time), 
        drop_temp = COALESCE(?, drop_temp),
        ram_pressure = COALESCE(?, ram_pressure),
        rotor_speed = COALESCE(?, rotor_speed),
        chamber_temp = COALESCE(?, chamber_temp),
        fill_factor = COALESCE(?, fill_factor),
        power_consumption = COALESCE(?, power_consumption),
        mixing_temp = COALESCE(?, mixing_temp),
        barcode = ?
      WHERE mb_id = ?
    `;

    db.query(sql, [
      actual_qty, 
      mix_time || null, 
      drop_temp || null, 
      ram_pressure || null, 
      rotor_speed || null, 
      chamber_temp || null, 
      fill_factor || null, 
      power_consumption || null, 
      mixing_temp || null, 
      mb_number, 
      id
    ], (err2) => {
      if (err2) return res.status(500).json({ message: 'Failed to complete batch', error: err2.message });
      res.json({ message: 'Master Batch complete!', barcode: mb_number });
    });
  });
};

// GET pending master batches (for Final Batch select dropdown)
exports.getPendingMasterBatches = (req, res) => {
  const sql = `
    SELECT mb.*, r.recipe_name 
    FROM master_batches mb
    JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
    WHERE mb.status = 'Completed'
    ORDER BY mb.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve batches', error: err.message });
    res.json(results);
  });
};


// ─── PART 3: FINAL BATCH ───────────────────────────────────────────────

// GET all final batches list
exports.getFinalBatches = (req, res) => {
  const sql = `
    SELECT 
      fb.*,
      mb.mb_number,
      r.recipe_name,
      r.recipe_code,
      m.machine_code,
      m.machine_name,
      u.name as operator_name
    FROM final_batches fb
    JOIN master_batches mb ON fb.mb_id = mb.mb_id
    JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
    LEFT JOIN machines m ON fb.machine_id = m.machine_id
    LEFT JOIN users u ON fb.operator_id = u.user_id
    ORDER BY fb.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve final batches', error: err.message });
    res.json(results);
  });
};

// POST create final batch (linked to master batch)
exports.createFinalBatch = (req, res) => {
  const { mb_id, machine_id, operator_id, planned_qty } = req.body;

  if (!mb_id || !machine_id || !operator_id || !planned_qty) {
    return res.status(400).json({ message: 'Missing Final Batch creation parameters.' });
  }

  db.query("SELECT COUNT(*) as count FROM final_batches", (err, countResult) => {
    if (err) return res.status(500).json({ message: 'Database lookup error', error: err.message });

    const count = countResult[0].count + 1;
    const year = new Date().getFullYear();
    const fb_number = `FB/${year}/${String(count).padStart(5, '0')}`;

    db.beginTransaction((transactionErr) => {
      if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

      const insertSql = `
        INSERT INTO final_batches (fb_number, mb_id, machine_id, operator_id, planned_qty, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
      `;

      db.query(insertSql, [fb_number, mb_id, machine_id, operator_id, planned_qty], (err2, insertRes) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Final Batch insert failed', error: err2.message }));
        }

        const fb_id = insertRes.insertId;

        // Fetch parent master batch and recipe to calculate curatives quantity (Accelerators & Sulfur)
        db.query("SELECT mb.recipe_id, mb.actual_qty FROM master_batches mb WHERE mb.mb_id = ?", [mb_id], (err3, masterRows) => {
          if (err3 || masterRows.length === 0) {
            return db.rollback(() => res.status(404).json({ message: 'Master Batch details not found' }));
          }

          const { recipe_id } = masterRows[0];

          db.query("SELECT * FROM mixing_recipe_items WHERE recipe_id = ?", [recipe_id], (err4, recipeItems) => {
            if (err4) {
              return db.rollback(() => res.status(500).json({ message: 'Recipe items fetch failed', error: err4.message }));
            }

            db.query("SELECT item_id, item_name FROM items", (err5, itemsList) => {
              if (err5) {
                return db.rollback(() => res.status(500).json({ message: 'Items list fetch failed', error: err5.message }));
              }

              // Curatives: CBS, Sulfur, TMTD, MBTS, Peroxides, etc.
              const curativeKeywords = ['sulfur', 'cbs', 'tmtd', 'mbts', 'peroxide', 'dcp', 'accelerator'];
              const curativeIngredients = recipeItems.filter(ri => {
                const itemName = itemsList.find(it => it.item_id === ri.raw_material_id)?.item_name?.toLowerCase() || '';
                return curativeKeywords.some(keyword => itemName.includes(keyword));
              });

              // Scale curative quantities to batch size
              const curativeValues = curativeIngredients.map(ri => {
                const reqQty = (parseFloat(ri.quantity) / 100) * planned_qty;
                return [fb_id, ri.raw_material_id, reqQty];
              });

              if (curativeValues.length === 0) {
                // If recipe has no explicit curatives, add placeholder (e.g. Sulfur)
                const sulfurId = findItemId(itemsList, 'RM-SULFUR') || 14;
                curativeValues.push([fb_id, sulfurId, planned_qty * 0.015]); // default 1.5% sulfur
              }

              const insertMaterialsSql = `INSERT INTO final_batch_materials (fb_id, item_id, required_qty) VALUES ?`;
              db.query(insertMaterialsSql, [curativeValues], (err6) => {
                if (err6) {
                  return db.rollback(() => res.status(500).json({ message: 'Curative materials insert failed', error: err6.message }));
                }

                db.commit((commitErr) => {
                  if (commitErr) {
                    return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
                  }
                  res.status(201).json({ message: 'Final Batch initialized', fb_id, fb_number });
                });
              });
            });
          });
        });
      });
    });
  });
};

function findItemId(itemsList, code) {
  return itemsList.find(i => i.item_code === code)?.item_id;
}

// GET single final batch detail
exports.getFinalBatchById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      fb.*,
      mb.mb_number,
      mb.actual_qty as mb_weight,
      r.recipe_name,
      r.recipe_code,
      m.machine_code,
      m.machine_name,
      u.name as operator_name
    FROM final_batches fb
    JOIN master_batches mb ON fb.mb_id = mb.mb_id
    JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
    LEFT JOIN machines m ON fb.machine_id = m.machine_id
    LEFT JOIN users u ON fb.operator_id = u.user_id
    WHERE fb.fb_id = ?
  `;

  db.query(sql, [id], (err, batchRows) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve batch', error: err.message });
    if (batchRows.length === 0) return res.status(404).json({ message: 'Batch not found' });

    const materialsSql = `
      SELECT 
        fbm.*,
        i.item_code as material_code,
        i.item_name as material_name,
        i.unit as material_unit,
        COALESCE(sp.current_qty, 0) as stock_qty
      FROM final_batch_materials fbm
      JOIN items i ON fbm.item_id = i.item_id
      LEFT JOIN stock_positions sp ON i.item_id = sp.item_id AND sp.store_id = 1
      WHERE fbm.fb_id = ?
    `;

    db.query(materialsSql, [id], (err2, materialRows) => {
      if (err2) return res.status(500).json({ message: 'Failed to retrieve curatives list', error: err2.message });
      res.json({
        batch: batchRows[0],
        materials: materialRows
      });
    });
  });
};

// PUT start final batch (issue materials and set In Progress)
exports.startFinalBatch = (req, res) => {
  const { id } = req.params;

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    db.query("SELECT fb_number, operator_id FROM final_batches WHERE fb_id = ?", [id], (err, batchRows) => {
      if (err || batchRows.length === 0) {
        return db.rollback(() => res.status(404).json({ message: 'Batch not found' }));
      }
      const { fb_number, operator_id } = batchRows[0];

      db.query("SELECT * FROM final_batch_materials WHERE fb_id = ?", [id], async (err2, materials) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Materials fetch failed', error: err2.message }));
        }

        try {
          for (const m of materials) {
            await updateStock(
              db,
              m.item_id,
              1, // Store 1: Raw Material Store
              -m.required_qty,
              'Issue',
              fb_number,
              operator_id
            );
          }

          await new Promise((resolve, reject) => {
            db.query("UPDATE final_batch_materials SET issued_qty = required_qty WHERE fb_id = ?", [id], (err3) => {
              if (err3) return reject(err3);
              resolve();
            });
          });

          await new Promise((resolve, reject) => {
            db.query("UPDATE final_batches SET status = 'In Progress', start_time = NOW() WHERE fb_id = ?", [id], (err4) => {
              if (err4) return reject(err4);
              resolve();
            });
          });

          db.commit((commitErr) => {
            if (commitErr) {
              return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
            }
            res.json({ message: 'Final Batch started. Curatives issued and stock updated successfully!' });
          });

        } catch (execErr) {
          db.rollback(() => res.status(500).json({ message: 'Failed to start Final Batch: ' + execErr.message }));
        }
      });
    });
  });
};

// PUT complete final batch (save parameters, set status = Awaiting Lab Test / Completed)
exports.completeFinalBatch = (req, res) => {
  const { id } = req.params;
  const { actual_qty, mix_time, drop_temp, mooney_viscosity, fill_factor, power_consumption, mixing_temp } = req.body;

  if (!actual_qty) {
    return res.status(400).json({ message: 'Actual compound output weight is required.' });
  }

  db.query("SELECT fb_number FROM final_batches WHERE fb_id = ?", [id], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ message: 'Batch not found' });
    const fb_number = rows[0].fb_number;

    const sql = `
      UPDATE final_batches 
      SET 
        status = 'Completed', 
        end_time = NOW(), 
        actual_qty = ?, 
        mix_time = COALESCE(?, mix_time), 
        drop_temp = COALESCE(?, drop_temp),
        mooney_viscosity = COALESCE(?, mooney_viscosity),
        fill_factor = COALESCE(?, fill_factor),
        power_consumption = COALESCE(?, power_consumption),
        mixing_temp = COALESCE(?, mixing_temp),
        barcode = ?
      WHERE fb_id = ?
    `;

    db.query(sql, [
      actual_qty, 
      mix_time || null, 
      drop_temp || null, 
      mooney_viscosity || null, 
      fill_factor || null, 
      power_consumption || null, 
      mixing_temp || null, 
      fb_number, 
      id
    ], (err2) => {
      if (err2) return res.status(500).json({ message: 'Failed to complete final batch', error: err2.message });
      res.json({ message: 'Final Batch compounding complete!', barcode: fb_number });
    });
  });
};


// ─── PART 4: LAB QUALITY (Compound Store) ──────────────────────────────

// GET all pending lab tests
exports.getPendingLabTests = (req, res) => {
  const sql = `
    SELECT 
      fb.fb_id, 
      fb.fb_number, 
      fb.actual_qty, 
      fb.status,
      fb.created_at, 
      r.recipe_name 
    FROM final_batches fb
    JOIN master_batches mb ON fb.mb_id = mb.mb_id
    JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
    WHERE fb.status IN ('Completed', 'Approved', 'Rejected', 'Rework Pending', 'Scrapped')
    ORDER BY fb.created_at DESC
    LIMIT 30
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve queue', error: err.message });
    res.json(results);
  });
};

exports.reviewFinalBatch = (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body; // action: 'Rework' or 'Scrap'

  if (!action || !['Rework', 'Scrap'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action. Must be Rework or Scrap.' });
  }

  const newStatus = action === 'Rework' ? 'Rework Pending' : 'Scrapped';

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ message: 'Transaction error', error: err.message });

    db.query("UPDATE final_batches SET status = ? WHERE fb_id = ?", [newStatus, id], (err2) => {
      if (err2) {
        return db.rollback(() => res.status(500).json({ message: 'Update failed', error: err2.message }));
      }

      // Update NCR ticket if exists
      db.query(`
        UPDATE non_conformances nc
        JOIN qc_inspections qci ON nc.inspection_id = qci.inspection_id
        SET nc.status = ?, nc.action_taken = ?, nc.closure_remarks = ?
        WHERE qci.label_number = (SELECT fb_number FROM final_batches WHERE fb_id = ?)
      `, [action === 'Rework' ? 'Closed' : 'Closed', action === 'Rework' ? 'Sent for re-mixing' : 'Scrapped batch', remarks || 'QA Review complete.'], (err3) => {
        if (err3) console.error('Failed to update NCR ticket:', err3.message);

        db.commit((commitErr) => {
          if (commitErr) {
            return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
          }
          res.json({ message: `Batch successfully updated to ${newStatus}!`, status: newStatus });
        });
      });
    });
  });
};

// GET lab result for a batch
exports.getLabResultsByBatchId = (req, res) => {
  const { fb_id } = req.params;
  const testSql = `SELECT * FROM lab_tests WHERE fb_id = ?`;
  
  db.query(testSql, [fb_id], (err, testRows) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve test', error: err.message });
    if (testRows.length === 0) return res.json({ message: 'No tests recorded.' });

    const itemsSql = `SELECT * FROM lab_test_items WHERE test_id = ?`;
    db.query(itemsSql, [testRows[0].test_id], (err2, itemRows) => {
      res.json({
        test: testRows[0],
        results: itemRows
      });
    });
  });
};

// POST submit lab test results
exports.submitLabTest = (req, res) => {
  const { fb_id, overall_result, tested_by, remarks, tests } = req.body;

  if (!fb_id || !overall_result || !tested_by || !tests || !Array.isArray(tests)) {
    return res.status(400).json({ message: 'Missing Lab Quality test results.' });
  }

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    const testSql = `
      INSERT INTO lab_tests (fb_id, overall_result, tested_by, test_date, remarks, approved_by)
      VALUES (?, ?, ?, NOW(), ?, ?)
    `;
    const approved_by = overall_result === 'Approved' ? tested_by : null;

    db.query(testSql, [fb_id, overall_result, tested_by, remarks || null, approved_by], (err2, testRes) => {
      if (err2) {
        return db.rollback(() => res.status(500).json({ message: 'Lab test header insert failed', error: err2.message }));
      }

      const test_id = testRes.insertId;
      const testItemSql = `
        INSERT INTO lab_test_items (test_id, test_name, specification_min, specification_max, actual_value, result)
        VALUES ?
      `;
      const testValues = tests.map(t => [
        test_id,
        t.test_name,
        t.specification_min || null,
        t.specification_max || null,
        t.actual_value,
        t.result || 'Pending'
      ]);

      db.query(testItemSql, [testValues], (err3) => {
        if (err3) {
          return db.rollback(() => res.status(500).json({ message: 'Lab test items insert failed', error: err3.message }));
        }

        // Update Final Batch status to Approved or Rejected
        const finalStatus = overall_result === 'Approved' ? 'Approved' : 'Rejected';
        db.query("UPDATE final_batches SET status = ? WHERE fb_id = ?", [finalStatus, fb_id], (err4) => {
          if (err4) {
            return db.rollback(() => res.status(500).json({ message: 'Final batch status update failed', error: err4.message }));
          }

          const commitTransaction = () => {
            db.commit((commitErr) => {
              if (commitErr) {
                return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
              }
              res.json({ message: 'Lab results published successfully!', status: finalStatus });
            });
          };

          // Retrieve batch details to construct inspection entry
          db.query("SELECT fb_number, item_id, actual_qty FROM final_batches WHERE fb_id = ?", [fb_id], (err5, fbRows) => {
            if (err5 || fbRows.length === 0) {
              return commitTransaction();
            }

            const fbRow = fbRows[0];
            const insNum = `INS/MIX/${new Date().getFullYear()}/${fb_id}`;
            const inspectedQty = parseFloat(fbRow.actual_qty || 0);
            const acceptedQty = finalStatus === 'Approved' ? inspectedQty : 0;
            const rejectedQty = finalStatus === 'Rejected' ? inspectedQty : 0;
            const qcResult = finalStatus === 'Approved' ? 'Accepted' : 'Rejected';

            const insSql = `
              INSERT INTO qc_inspections 
                (inspection_number, inspection_type, item_id, inspected_qty, accepted_qty, rejected_qty, result, inspected_by, inspection_date, remarks, label_number)
              VALUES 
                (?, 'In-Process', ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)
            `;

            db.query(insSql, [insNum, fbRow.item_id, inspectedQty, acceptedQty, rejectedQty, qcResult, tested_by, remarks || 'Lab tested.', fbRow.fb_number], (err6, insRes) => {
              if (err6) {
                console.error('Failed to create qc_inspections log:', err6.message);
                return commitTransaction();
              }

              const inspectionId = insRes.insertId;

              // If Rejected, create Non-Conformance report linked to this inspection_id
              if (finalStatus === 'Rejected') {
                const ncNum = `NC/MIX/${new Date().getFullYear()}/${fb_id}`;
                const defectDesc = `Lab QC test failure on final compound batch ${fbRow.fb_number}. Remarks: ${remarks || 'None'}`;
                
                const ncSql = `
                  INSERT INTO non_conformances 
                    (nc_number, inspection_id, defect_type, defect_description, qty_affected, severity, status, raised_by, created_at)
                  VALUES 
                    (?, ?, 'Lab Quality Failure', ?, ?, 'Critical', 'Open', ?, NOW())
                `;

                db.query(ncSql, [ncNum, inspectionId, defectDesc, inspectedQty, tested_by], (err7) => {
                  if (err7) console.error('Failed to create non-conformance log:', err7.message);
                  commitTransaction();
                });
              } else {
                updateStock(
                  db,
                  fbRow.item_id,
                  1,
                  inspectedQty,
                  'FG Receipt',
                  fbRow.fb_number,
                  tested_by
                )
                  .then(() => commitTransaction())
                  .catch(err => {
                    console.error('Failed to log stock receipt for approved batch:', err.message);
                    commitTransaction();
                  });
              }
            });
          });
        });
      });
    });
  });
};

// GET all approved batches in Compound Store (ready for moulding)
exports.getCompoundStore = (req, res) => {
  const sql = `
    SELECT 
      fb.fb_id,
      fb.fb_number,
      fb.actual_qty as weight_available,
      fb.end_time as date_made,
      fb.status,
      r.recipe_name,
      r.recipe_code,
      m.machine_code
    FROM final_batches fb
    JOIN master_batches mb ON fb.mb_id = mb.mb_id
    JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
    LEFT JOIN machines m ON fb.machine_id = m.machine_id
    WHERE fb.status = 'Approved'
    ORDER BY fb.end_time DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve store stock', error: err.message });
    res.json(results);
  });
};

// PUT scan barcode and issue compound batch to moulding
exports.issueCompoundToMoulding = (req, res) => {
  const { barcode } = req.body;
  const user = req.user || {};

  if (!barcode) return res.status(400).json({ message: 'Barcode scan input required.' });

  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ message: 'Transaction error', error: transactionErr.message });

    db.query("SELECT * FROM final_batches WHERE fb_number = ? AND status = 'Approved'", [barcode], (err, rows) => {
      if (err || rows.length === 0) {
        return db.rollback(() => res.status(404).json({ message: 'Approved ready-to-use Final Batch not found for scanned barcode.' }));
      }
      
      const batch = rows[0];

      // Mark status as Completed or custom Issued state to subtract from Compound Store
      // In this OEE system, let's update status to 'Completed' (fully consumed) or write ledger entry
      db.query("UPDATE final_batches SET status = 'Completed' WHERE fb_id = ?", [batch.fb_id], async (err2) => {
        if (err2) {
          return db.rollback(() => res.status(500).json({ message: 'Failed to update final batch status', error: err2.message }));
        }

        try {
          // Log inside stock ledger: compound items stock out (deduct from store)
          await updateStock(
            db,
            batch.item_id,
            1, // Store 1: Raw Material Store (or Compound Store area)
            -batch.actual_qty, // Deduct stock
            'Issue',
            batch.fb_number,
            user.user_id || 1
          );

          db.commit((commitErr) => {
            if (commitErr) {
              return db.rollback(() => res.status(500).json({ message: 'Commit failed', error: commitErr.message }));
            }
            res.json({
              message: `Batch ${batch.fb_number} successfully issued to moulding!`,
              batchNumber: batch.fb_number,
              weight: batch.actual_qty
            });
          });

        } catch (execErr) {
          db.rollback(() => res.status(500).json({ message: 'Issue failed: ' + execErr.message }));
        }
      });
    });
  });
};

// ─── TRACEABILITY BATCH CARD SEARCH ────────────────────────────────────

// GET single batch card with full history (scans both MB and FB)
exports.getBatchCardData = (req, res) => {
  const barcode = req.query.barcode || req.params.barcode;

  // Search if Master Batch first
  db.query("SELECT * FROM master_batches WHERE mb_number = ?", [barcode], (err, mbRows) => {
    if (err) return res.status(500).json({ message: 'Error searching database', error: err.message });

    if (mbRows.length > 0) {
      // It's a Master Batch!
      const mb = mbRows[0];
      const sql = `
        SELECT 
          mb.*,
          r.recipe_name,
          r.recipe_code,
          m.machine_code,
          m.machine_name,
          u.name as operator_name
        FROM master_batches mb
        JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
        LEFT JOIN machines m ON mb.machine_id = m.machine_id
        LEFT JOIN users u ON mb.operator_id = u.user_id
        WHERE mb.mb_id = ?
      `;

      db.query(sql, [mb.mb_id], (err2, details) => {
        // Fetch raw material items used
        const matSql = `
          SELECT mbm.*, i.item_code, i.item_name, i.unit
          FROM master_batch_materials mbm
          JOIN items i ON mbm.item_id = i.item_id
          WHERE mbm.mb_id = ?
        `;
        db.query(matSql, [mb.mb_id], (err3, mats) => {
          // Fetch child Final Batches
          const childSql = `SELECT fb_id, fb_number, actual_qty, status, created_at FROM final_batches WHERE mb_id = ?`;
          db.query(childSql, [mb.mb_id], (err4, children) => {
            res.json({
              type: 'Master',
              batch: details[0],
              materials: mats,
              childFinals: children
            });
          });
        });
      });
    } else {
      // Search if Final Batch
      db.query("SELECT * FROM final_batches WHERE fb_number = ?", [barcode], (err2, fbRows) => {
        if (err2) return res.status(500).json({ message: 'Error searching database', error: err2.message });
        if (fbRows.length === 0) return res.status(454).json({ message: 'Batch not found. Scan valid Master or Final code.' });

        const fb = fbRows[0];
        const sql = `
          SELECT 
            fb.*,
            mb.mb_number,
            mb.actual_qty as mb_weight,
            r.recipe_name,
            r.recipe_code,
            m.machine_code,
            m.machine_name,
            u.name as operator_name
          FROM final_batches fb
          JOIN master_batches mb ON fb.mb_id = mb.mb_id
          JOIN mixing_recipes r ON mb.recipe_id = r.recipe_id
          LEFT JOIN machines m ON fb.machine_id = m.machine_id
          LEFT JOIN users u ON fb.operator_id = u.user_id
          WHERE fb.fb_id = ?
        `;

        db.query(sql, [fb.fb_id], (err3, details) => {
          const matSql = `
            SELECT fbm.*, i.item_code, i.item_name, i.unit
            FROM final_batch_materials fbm
            JOIN items i ON fbm.item_id = i.item_id
            WHERE fbm.fb_id = ?
          `;
          db.query(matSql, [fb.fb_id], (err4, mats) => {
            // Fetch lab test outcomes
            const testSql = `
              SELECT lt.*, u.name as tester_name
              FROM lab_tests lt
              LEFT JOIN users u ON lt.tested_by = u.user_id
              WHERE lt.fb_id = ?
            `;
            db.query(testSql, [fb.fb_id], (err5, tests) => {
              if (tests.length > 0) {
                db.query("SELECT * FROM lab_test_items WHERE test_id = ?", [tests[0].test_id], (err6, testItems) => {
                  res.json({
                    type: 'Final',
                    batch: details[0],
                    materials: mats,
                    labTest: tests[0],
                    labTestItems: testItems
                  });
                });
              } else {
                res.json({
                  type: 'Final',
                  batch: details[0],
                  materials: mats,
                  labTest: null
                });
              }
            });
          });
        });
      });
    }
  });
};

// GET raw materials list
exports.getRawMaterials = (req, res) => {
  const sql = `
    SELECT item_id, item_code, item_name, unit 
    FROM items 
    WHERE category = 'Raw Material'
    ORDER BY item_name ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to retrieve raw materials', error: err.message });
    res.json(results);
  });
};
