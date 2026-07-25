const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');

router.get('/gate-pass', reportsController.getGatePassReport);
router.get('/grn', reportsController.getGrnReport);
router.get('/production', reportsController.getProductionReport);
router.get('/machine-wise', reportsController.getMachineWiseReport);
router.get('/inspection', reportsController.getInspectionReport);
router.get('/defect-pareto', reportsController.getDefectParetoReport);
router.get('/traceability', reportsController.getTraceabilityReport);
router.get('/stock-position', reportsController.getStockPositionReport);
router.get('/dispatch', reportsController.getDispatchReport);
router.get('/daily-mis', reportsController.getDailyMisReport);

module.exports = router;
