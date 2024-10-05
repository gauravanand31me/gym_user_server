const { getNotifications } = require("../controllers/getNotification");
const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const router = express.Router();

router.get('/get', authMiddleware, getNotifications);

module.exports = router;