const express = require('express');
const { createBooking, inviteBuddies, getAllBookingsByUser } = require('../controllers/bookingController');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create', authMiddleware, createBooking);
router.post('/invite', authMiddleware, inviteBuddies);
router.get('/get', authMiddleware, getAllBookingsByUser);
module.exports = router;
