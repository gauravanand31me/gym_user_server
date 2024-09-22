const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { sendFriendRequest, acceptRequest, rejectRequest, getFriendRequests } = require('../controllers/friendRequest');
const router = express.Router();

router.post('/add', authMiddleware, sendFriendRequest);
router.post('/accept', authMiddleware, acceptRequest);
router.get('/get', authMiddleware, getFriendRequests);
router.post('/reject', authMiddleware, rejectRequest);
module.exports = router;
