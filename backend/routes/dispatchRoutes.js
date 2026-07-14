const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatchController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, dispatchController.getDispatchOrders);
router.get('/stats', authMiddleware, dispatchController.getDispatchStats);
router.get('/customers', authMiddleware, dispatchController.getCustomers);
router.get('/fg-items', authMiddleware, dispatchController.getFGItems);
router.get('/fg-stock/:customer_id', authMiddleware, dispatchController.getCustomerFGStock);
router.get('/lookup', authMiddleware, dispatchController.lookupBarcode);
router.post('/', authMiddleware, dispatchController.createDispatchOrder);
router.put('/:id', authMiddleware, dispatchController.updateDispatchOrder);
router.put('/:id/pdi', authMiddleware, dispatchController.submitPDI);
router.put('/:id/scan-load', authMiddleware, dispatchController.scanLoadItem);
router.put('/:id/close', authMiddleware, dispatchController.closeShipment);
router.put('/:id/delivered', authMiddleware, dispatchController.markDelivered);
router.get('/:id', authMiddleware, dispatchController.getDispatchOrderById);

module.exports = router;
