const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getAllGatePasses, getGatePass, createGatePass,
  updateStatus, getSuppliers, getItems
} = require('../controllers/gatePassController');

router.get('/', auth, getAllGatePasses);
router.get('/suppliers', auth, getSuppliers);
router.get('/items', auth, getItems);
router.get('/:id', auth, getGatePass);
router.post('/', auth, createGatePass);
router.put('/:id/status', auth, updateStatus);

module.exports = router;