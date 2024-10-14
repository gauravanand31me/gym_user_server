const express = require('express');
const { createBooking, inviteBuddies, getAllBookingsByUser, createOrder, verifyBooking, getIndividualBooking, getAllVisitedGymsWithWorkoutHours } = require('../controllers/bookingController');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create', authMiddleware, createBooking);
router.post('/invite', authMiddleware, inviteBuddies);
router.get('/get', authMiddleware, getAllBookingsByUser);
router.post('/initiate', authMiddleware, createOrder);
router.get('/indv', authMiddleware, getIndividualBooking);
router.get('/verify', verifyBooking);
router.get('/visited-gyms', authMiddleware, getAllVisitedGymsWithWorkoutHours);
module.exports = router;
