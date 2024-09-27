const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getAllBuddyRequest, sendBuddyRequest } = require('../controllers/getAllBuddyRequest');

const router = express.Router();

router.get('/get', authMiddleware, getAllBuddyRequest);
router.post('/send', authMiddleware, sendBuddyRequest);

module.exports = router;
