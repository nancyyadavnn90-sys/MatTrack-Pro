const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getAllGRNs, getGRN, createGRN, updateStatus,
  getOpenGatePasses, getGatePassItems, getStores
} = require('../controllers/grnController');

router.get('/', auth, getAllGRNs);
router.get('/open-gate-passes', auth, getOpenGatePasses);
router.get('/stores', auth, getStores);
router.get('/gate-pass-items/:gp_id', auth, getGatePassItems);
router.get('/:id', auth, getGRN);
router.post('/', auth, createGRN);
router.put('/:id/status', auth, updateStatus);

module.exports = router;