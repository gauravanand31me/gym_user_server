const express = require('express');
const { register, verifyOTP, login } = require('../controllers/authController');
const { socialLogin } = require('../controllers/socialAuthController');
const router = express.Router();

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/social-login', socialLogin);

module.exports = router;
