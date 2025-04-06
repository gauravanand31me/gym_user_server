const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createBookingRating, getBookingRating } = require('../controllers/bookingRatingController');
const router = express.Router();

router.post('/post', authMiddleware, createBookingRating)
router.get('/get', authMiddleware, getBookingRating);

module.exports = router;