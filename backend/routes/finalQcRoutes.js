const express = require('express');
const router = express.Router();
const finalQcController = require('../controllers/finalQcController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/work-orders', authMiddleware, finalQcController.getLinkableWorkOrders);
router.get('/pending', authMiddleware, finalQcController.getPendingFQC);
router.post('/inspections', authMiddleware, finalQcController.createFinalQC);
router.get('/inspections', authMiddleware, finalQcController.getFinalQCInspections);
router.get('/inspections/:id', authMiddleware, finalQcController.getFinalQCById);
router.get('/ncrs', authMiddleware, finalQcController.getFinalQCNCRList);
router.post('/ncrs/:id/close', authMiddleware, finalQcController.closeFinalQCNCR);
router.get('/stats', authMiddleware, finalQcController.getFinalQCStats);

module.exports = router;
