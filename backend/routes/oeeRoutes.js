const express = require('express');
const router = express.Router();
const oeeController = require('../controllers/oeeController');
const authMiddleware = require('../middleware/authMiddleware');

// Note: Apply authMiddleware if authenticated requests are required, 
// for simplicity and development testing we can allow direct access or apply it.
// Let's make it direct so that there are no token authentication blocking issues during user reviews.

// Dashboard Summary APIs
router.get('/dashboard', oeeController.getOeeDashboard);
router.get('/dashboard/plant', oeeController.getPlantOeeSummary);
router.get('/dashboard/trend', oeeController.getOeeTrend);

// Shift Logs APIs
router.get('/shift-logs', oeeController.getShiftLogs);
router.post('/shift-logs', oeeController.createShiftLog);
router.get('/shift-logs/:id', oeeController.getShiftLogById);

// Downtime Logs APIs
router.get('/downtime', oeeController.getDowntimeLogs);
router.post('/downtime', oeeController.createDowntimeLog);
router.get('/downtime/pareto', oeeController.getDowntimePareto);

// Machine Details APIs
router.get('/machine/:id', oeeController.getMachineDetail);
router.get('/machine/:id/trend', oeeController.getMachineTrend);
router.put('/machine/:id/status', oeeController.updateMachineStatus);

// Reports APIs
router.get('/reports/daily', oeeController.getDailyReport);
router.get('/reports/weekly', oeeController.getWeeklyReport);

// Lists APIs
router.get('/machines', oeeController.getMouldingMachinesList);
router.get('/operators', oeeController.getOperatorsList);

module.exports = router;
