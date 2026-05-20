const express = require('express');
const rateLimit = require('express-rate-limit');
const { addAddress, getAddress } = require('../controllers/addressController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Max 10 address saves per user per 10 minutes
const addAddressLimiter = rateLimit({
  windowMs:         10 * 60 * 1000,
  max:              10,
  keyGenerator:     (req) => req.user?.id || req.ip,
  skip:             (req) => req.method !== 'POST',
  handler:          (req, res) => res.status(429).json({ message: 'Too many requests. Please wait before updating your address again.' }),
  standardHeaders:  true,
  legacyHeaders:    false,
});

router.post('/add', authMiddleware, addAddressLimiter, addAddress);
router.get('/get', authMiddleware, getAddress);


module.exports = router;
