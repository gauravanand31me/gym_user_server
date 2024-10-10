const { getNotifications, markNotificationsAsRead } = require("../controllers/getNotification");
const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const router = express.Router();

router.get('/get', authMiddleware, getNotifications);
router.post('/mark-all-read', authMiddleware, markNotificationsAsRead);
module.exports = router;