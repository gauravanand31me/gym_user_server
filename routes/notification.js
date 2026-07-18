const { getNotifications, markNotificationsAsRead } = require("../controllers/getNotification");
const { listPushTokens, testPush } = require("../controllers/testPushController");
const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const router = express.Router();

router.get('/get', authMiddleware, getNotifications);
router.post('/mark-all-read', authMiddleware, markNotificationsAsRead);

// ── Push notification debug endpoints (admin-secret protected) ──
router.get('/push-tokens', listPushTokens);
router.post('/test-push', testPush);

module.exports = router;