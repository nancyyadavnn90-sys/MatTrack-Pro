const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getStockPositions,
  getStockLedger,
  getLowStockAlerts,
  getExpiryAlerts,
  getLabels,
  putAway,
  transferStock,
  adjustStock,
  issueMaterial,
  getUsers,
  getItems
} = require('../controllers/inventoryController');

router.get('/positions', auth, getStockPositions);
router.get('/ledger', auth, getStockLedger);
router.get('/low-stock', auth, getLowStockAlerts);
router.get('/expiring', auth, getExpiryAlerts);
router.get('/labels', auth, getLabels);
router.get('/users', auth, getUsers);
router.get('/items', auth, getItems);
router.post('/put-away', auth, putAway);
router.post('/transfer', auth, transferStock);
router.post('/adjust', auth, adjustStock);
router.post('/issue', auth, issueMaterial);

module.exports = router;
