const express = require('express');
const router = express.Router();
const mixingController = require('../controllers/mixingController');
const authMiddleware = require('../middleware/authMiddleware');

// Part 1: Recipes & Formulas
router.get('/recipes', authMiddleware, mixingController.getRecipes);
router.post('/recipes', authMiddleware, mixingController.createRecipe);
router.get('/recipes/:id', authMiddleware, mixingController.getRecipeById);
router.put('/recipes/:id', authMiddleware, mixingController.updateRecipe);
router.get('/recipes/versions/:code', authMiddleware, mixingController.getRecipeVersions);

// Part 2: Master Batches
router.get('/master-batches', authMiddleware, mixingController.getMasterBatches);
router.post('/master-batches', authMiddleware, mixingController.createMasterBatch);
router.get('/master-batches/pending', authMiddleware, mixingController.getPendingMasterBatches);
router.get('/master-batches/:id', authMiddleware, mixingController.getMasterBatchById);
router.put('/master-batches/:id/start', authMiddleware, mixingController.startMasterBatch);
router.put('/master-batches/:id/complete', authMiddleware, mixingController.completeMasterBatch);
router.put('/master-batches/:id/parameters', authMiddleware, mixingController.addMasterParameters);

// Part 3: Final Batches
router.get('/final-batches', authMiddleware, mixingController.getFinalBatches);
router.post('/final-batches', authMiddleware, mixingController.createFinalBatch);
router.get('/final-batches/:id', authMiddleware, mixingController.getFinalBatchById);
router.put('/final-batches/:id/start', authMiddleware, mixingController.startFinalBatch);
router.put('/final-batches/:id/complete', authMiddleware, mixingController.completeFinalBatch);
router.put('/final-batches/:id/review', authMiddleware, mixingController.reviewFinalBatch);

// Part 4: Lab Quality & Compound Store
router.get('/lab-tests', authMiddleware, mixingController.getPendingLabTests);
router.post('/lab-tests', authMiddleware, mixingController.submitLabTest);
router.get('/lab-tests/:fb_id', authMiddleware, mixingController.getLabResultsByBatchId);
router.get('/compound-store', authMiddleware, mixingController.getCompoundStore);
router.put('/compound-store/issue', authMiddleware, mixingController.issueCompoundToMoulding);

// Batch Card & Traceability Search
router.get('/batch-card', authMiddleware, mixingController.getBatchCardData);
router.get('/batch-card/:barcode', authMiddleware, mixingController.getBatchCardData);
router.get('/raw-materials', authMiddleware, mixingController.getRawMaterials);

module.exports = router;
