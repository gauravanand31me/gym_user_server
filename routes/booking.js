const express = require('express');
const { createBooking, inviteBuddies, getAllBookingsByUser, createOrder, verifyBooking, getIndividualBooking, getAllVisitedGymsWithWorkoutHours, getAllBuddiesWithWorkoutHours, razorPayWebhook, declineBuddyRequest, razorPayWebhookPost, getAllGymCoupons } = require('../controllers/bookingController');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create', authMiddleware, createBooking);
router.delete('/deleteBuddyRequest/:requestId', authMiddleware, declineBuddyRequest);
router.post('/invite', authMiddleware, inviteBuddies);
router.get('/get', authMiddleware, getAllBookingsByUser);
router.post('/initiate', authMiddleware, createOrder);
router.get('/indv', authMiddleware, getIndividualBooking);
router.get('/verify', verifyBooking);
router.get('/webhook', razorPayWebhook);
router.post('/webhook', razorPayWebhookPost);
router.get('/visited-gyms', authMiddleware, getAllVisitedGymsWithWorkoutHours);
router.get('/coupons', authMiddleware, getAllGymCoupons);
router.get('/workout-hours', authMiddleware, getAllBuddiesWithWorkoutHours);
router.get('/workout-buddies', authMiddleware, getAllBuddiesWithWorkoutHours);
module.exports = router;
