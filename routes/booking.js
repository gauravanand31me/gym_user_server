const express = require('express');
const { createBooking, inviteBuddies, getAllBookingsByUser, createOrder, verifyBooking } = require('../controllers/bookingController');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create', authMiddleware, createBooking);
router.post('/invite', authMiddleware, inviteBuddies);
router.get('/get', authMiddleware, getAllBookingsByUser);
router.post('/initiate', authMiddleware, createOrder);
router.get('/verify', verifyBooking);
module.exports = router;
