const express = require('express');
const { register, verifyOTP, login } = require('../controllers/authController');
const { socialLogin, googleCallback, facebookCallback } = require('../controllers/socialAuthController');
const router = express.Router();

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/social-login', socialLogin);
router.get('/google/callback',   googleCallback);
router.get('/facebook/callback', facebookCallback);

module.exports = router;
