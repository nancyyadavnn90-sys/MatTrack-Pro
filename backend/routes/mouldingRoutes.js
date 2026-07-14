const express = require('express');
const router = express.Router();
const mouldingController = require('../controllers/mouldingController');
const authMiddleware = require('../middleware/authMiddleware');

// Moulds Master APIs
router.get('/moulds', authMiddleware, mouldingController.getMoulds);
router.post('/moulds', authMiddleware, mouldingController.createMould);
router.get('/moulds/:id', authMiddleware, mouldingController.getMouldById);
router.put('/moulds/:id', authMiddleware, mouldingController.updateMould);
router.post('/moulds/:id/maintenance', authMiddleware, mouldingController.logMouldMaintenance);

// Job Card APIs
router.get('/job-cards', authMiddleware, mouldingController.getJobCards);
router.post('/job-cards', authMiddleware, mouldingController.createJobCard);
router.get('/job-cards/:id', authMiddleware, mouldingController.getJobCardById);
router.put('/job-cards/:id/start', authMiddleware, mouldingController.startJobCardProduction);
router.put('/job-cards/:id/complete', authMiddleware, mouldingController.completeJobCardProduction);

// Production Entry APIs
router.post('/entries', authMiddleware, mouldingController.saveProductionEntry);
router.get('/entries/:jc_id', authMiddleware, mouldingController.getEntriesByJobCard);
router.get('/summary/:jc_id', authMiddleware, mouldingController.getProductionSummary);

// Purge Log APIs
router.post('/purge', authMiddleware, mouldingController.logPurge);
router.get('/purge', authMiddleware, mouldingController.getAllPurgeLogs);
router.get('/purge/:machine_id', authMiddleware, mouldingController.getPurgeHistory);

// Dropdown Helper APIs
router.get('/active-work-orders', authMiddleware, mouldingController.getActiveWorkOrders);
router.get('/approved-batches', authMiddleware, mouldingController.getApprovedFinalBatches);
router.get('/machines', authMiddleware, mouldingController.getMouldingMachines);
router.post('/machines', authMiddleware, mouldingController.createMouldingMachine);

// Barcode scanner lookup routes
router.get('/batches/lookup/:barcode', authMiddleware, mouldingController.lookupFinalBatch);
router.get('/moulds/lookup/:code', authMiddleware, mouldingController.lookupMouldByCode);
router.post('/rejections/log', authMiddleware, mouldingController.logStandaloneRejection);
router.post('/next-stage', authMiddleware, mouldingController.nextStageInward);
router.get('/wip/lookup/:barcode', authMiddleware, mouldingController.lookupWipBatch);

module.exports = router;
