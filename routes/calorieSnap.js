const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getTrialStatus,
  recordUsage,
  saveCalorieLog,
  getCalorieLogs,
  createOrder,
  createPaymentLink,
  verifyPayment,
  getSubscription,
  getAppConfig,
  updateAppConfig,
} = require('../controllers/calorieSnapController');

const router = express.Router();

// ── Trial & Usage ────────────────────────────────────────────────────────────
router.get('/trial-status',         authMiddleware, getTrialStatus);
router.post('/record-usage',        authMiddleware, recordUsage);

// ── Meal Logs ────────────────────────────────────────────────────────────────
router.post('/log',                 authMiddleware, saveCalorieLog);
router.get('/logs',                 authMiddleware, getCalorieLogs);

// ── Payment ──────────────────────────────────────────────────────────────────
router.post('/create-order',        authMiddleware, createOrder);
router.post('/create-payment-link', authMiddleware, createPaymentLink);
router.post('/verify-payment',      authMiddleware, verifyPayment);

// ── Subscription ─────────────────────────────────────────────────────────────
router.get('/subscription',         authMiddleware, getSubscription);

// ── Config (admin) ───────────────────────────────────────────────────────────
router.get('/config',               authMiddleware, getAppConfig);
router.put('/config',               authMiddleware, updateAppConfig);

module.exports = router;
