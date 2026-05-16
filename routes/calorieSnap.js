const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getTrialStatus,
  recordUsage,
  saveCalorieLog,
  getCalorieLogs,
  createOrder,
  verifyPayment,
} = require('../controllers/calorieSnapController');

const router = express.Router();

router.get('/trial-status',   authMiddleware, getTrialStatus);
router.post('/record-usage',  authMiddleware, recordUsage);
router.post('/log',           authMiddleware, saveCalorieLog);
router.get('/logs',           authMiddleware, getCalorieLogs);
router.post('/create-order',  authMiddleware, createOrder);
router.post('/verify-payment', authMiddleware, verifyPayment);

module.exports = router;
