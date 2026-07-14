const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const wipController = require('../controllers/wipController');

// Main board metrics
router.get('/board', authMiddleware, wipController.getWipBoard);
router.get('/stats', authMiddleware, wipController.getStats);

// Batches
router.get('/batches', authMiddleware, wipController.getBatches);
router.get('/batches/:id', authMiddleware, wipController.getBatchById);
router.post('/batches', authMiddleware, wipController.createBatch);
router.put('/batches/:id/move', authMiddleware, wipController.moveBatch);
router.put('/batches/:id/hold', authMiddleware, wipController.holdBatch);
router.put('/batches/:id/release', authMiddleware, wipController.releaseBatch);
router.put('/batches/:id/rework', authMiddleware, wipController.reworkBatch);
router.put('/batches/:id/complete', authMiddleware, wipController.completeBatch);

// Alerts
router.get('/alerts', authMiddleware, wipController.getAlerts);
router.put('/alerts/:id/acknowledge', authMiddleware, wipController.acknowledgeAlert);
router.put('/alerts/:id/resolve', authMiddleware, wipController.resolveAlert);

// Reports
router.get('/reports/lead-time', authMiddleware, wipController.getLeadTimeReport);
router.get('/reports/stage-time', authMiddleware, wipController.getStageTimeReport);
router.get('/reports/wo-status', authMiddleware, wipController.getWoStatusReport);

module.exports = router;
