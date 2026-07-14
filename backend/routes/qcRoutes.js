const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getQCQueue,
  getPassedInspections,
  getNonConformances,
  getNCDetail,
  getInspection,
  createInspection,
  closeNonConformance,
  getInspectionByLabel
} = require('../controllers/qcController');

router.get('/queue', auth, getQCQueue);
router.get('/passed', auth, getPassedInspections);
router.get('/ncs', auth, getNonConformances);
router.get('/ncs/:id', auth, getNCDetail);
router.get('/inspections/:id', auth, getInspection);
router.get('/inspections/label/:labelNumber', auth, getInspectionByLabel);
router.post('/inspections', auth, createInspection);
router.post('/ncs/:id/close', auth, closeNonConformance);

module.exports = router;
