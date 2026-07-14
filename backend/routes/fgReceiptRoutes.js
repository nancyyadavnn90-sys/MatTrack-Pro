const express = require('express');
const router = express.Router();
const fgReceiptController = require('../controllers/fgReceiptController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/pending', authMiddleware, fgReceiptController.getPendingQC);
router.get('/', authMiddleware, fgReceiptController.getFGReceipts);
router.get('/stats', authMiddleware, fgReceiptController.getFGReceiptStats);
router.get('/stores', authMiddleware, fgReceiptController.getFGStores);
router.post('/', authMiddleware, fgReceiptController.createFGReceipt);
router.get('/:id', authMiddleware, fgReceiptController.getFGReceiptById);

module.exports = router;
