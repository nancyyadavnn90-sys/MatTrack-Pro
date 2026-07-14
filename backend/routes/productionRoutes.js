const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const authMiddleware = require('../middleware/authMiddleware');

// ─── EXISTING MIXING MODULE ROUTES ─────────────────────────────────
router.get('/work-orders/mixing', authMiddleware, productionController.getMixingQueue);
router.get('/bom/:itemId', authMiddleware, productionController.getRecipe);
router.post('/mixing/complete', authMiddleware, productionController.completeMixingBatch);

// ─── NEW PRODUCTION / WORK ORDER MODULE ROUTES ─────────────────────

// Work Order Routes
router.get('/customers', authMiddleware, productionController.getCustomers);
router.get('/work-orders', authMiddleware, productionController.getWorkOrders);
router.post('/work-orders', authMiddleware, productionController.createWorkOrder);
router.get('/work-orders/:id', authMiddleware, productionController.getWorkOrderById);
router.put('/work-orders/:id', authMiddleware, productionController.updateWorkOrder);
router.put('/work-orders/:id/release', authMiddleware, productionController.releaseWorkOrder);
router.put('/work-orders/:id/cancel', authMiddleware, productionController.cancelWorkOrder);

// BOM Routes
router.get('/bom', authMiddleware, productionController.getBOMs);
router.post('/bom', authMiddleware, productionController.createBOM);
router.get('/bom/finished/:item_id', authMiddleware, productionController.getBOMByItemId);
router.put('/bom/:id', authMiddleware, productionController.updateBOM);

// Routing Templates Routes
router.get('/routing/:item_id', authMiddleware, productionController.getRoutingByItemId);
router.post('/routing', authMiddleware, productionController.createRouting);
router.put('/routing/:id', authMiddleware, productionController.updateRouting);

// MRN Routes
router.get('/mrn', authMiddleware, productionController.getMRNs);
router.post('/mrn', authMiddleware, productionController.createMRN);
router.get('/mrn/:id', authMiddleware, productionController.getMRNById);
router.put('/mrn/:id/issue', authMiddleware, productionController.issueMRNMaterial);
router.put('/mrn/:id/issue-batch', authMiddleware, productionController.issueMRNMaterialBatch);
router.put('/mrn/:id/close', authMiddleware, productionController.closeMRN);

// Shop Floor Live View Route
router.get('/shop-floor', authMiddleware, productionController.getShopFloorView);

module.exports = router;
