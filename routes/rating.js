const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createBookingRating, getBookingRating, getRatingsByGymId } = require('../controllers/bookingRatingController');
const router = express.Router();

router.post('/post', authMiddleware, createBookingRating)
router.get('/get  ', authMiddleware, getBookingRating);
router.get('/gym/:gymId', getRatingsByGymId);

module.exports = router;