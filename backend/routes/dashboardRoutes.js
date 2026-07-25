const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/summary', dashboardController.getSummary);
router.get('/wip-mini', dashboardController.getWipMini);
router.get('/oee-summary', dashboardController.getOeeSummary);
router.get('/work-orders', dashboardController.getWorkOrders);
router.get('/notifications', dashboardController.getNotifications);
router.get('/alerts', dashboardController.getAlerts);
router.get('/pending-tasks', dashboardController.getPendingTasks);
router.get('/stock-alerts', dashboardController.getStockAlerts);
router.get('/dispatch-month', dashboardController.getDispatchMonth);

module.exports = router;
