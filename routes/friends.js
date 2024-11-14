const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { sendFriendRequest, acceptRequest, rejectRequest, getFriendRequests, getFriendRequestById } = require('../controllers/friendRequest');
const router = express.Router();

router.post('/add', authMiddleware, sendFriendRequest);
router.post('/accept', authMiddleware, acceptRequest);
router.get('/get', authMiddleware, getFriendRequests);
router.post('/reject', authMiddleware, rejectRequest);
router.get('/getindv', authMiddleware, getFriendRequestById);
module.exports = router;
