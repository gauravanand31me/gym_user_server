// controllers/userController.js
const User = require('../models/User');
const { sendSMS } = require('../utils/sendSMS');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { isMobileNumber } = require('../helper/helper');
const JWT_SECRET = process.env.JWT_SECRET || "Test@1992"
// Register a new user
exports.register = async (req, res) => {
  const { full_name, mobile_number } = req.body;

  // Hardcoded password (you can replace it with a more secure method if needed)
  const password = 'hardcodedPassword123';
  const confirmPassword = password; // No need to confirm in this case

  if (!isMobileNumber(mobile_number)) {
    return res.status(400).send('Please enter valid mobile number.');
  }
  // Generate a unique OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Check for existing user
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { mobile_number },
          { username: full_name.toLowerCase().replace(/\s+/g, '') }
        ]
      }
    });
    if (existingUser) return res.status(400).send('Mobile number or username already exists');

    // Create a new user
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    const user = await User.create({
      full_name,
      username: `${full_name.toLowerCase().replace(/\s+/g, '')}_${randomNumber}`,
      mobile_number,
      password,
      otp,
      otpExpires: new Date(Date.now() + 3600000) // 1 hour expiry
    });

    // Send OTP via SMS
    sendSMS(mobile_number, `Your OTP is ${otp}`);

    res.status(201).send({
      status: true,
      message: `User registered successfully, please verify your OTP ${otp}`
    });
  } catch (error) {
    res.status(400).json({status: false, message: error.message});
  }
};


exports.verifyOTP = async (req, res) => {
  const { mobile_number, otp } = req.body;

  try {
    // Find the user with the given mobile number and OTP
    const user = await User.findOne({ where: { mobile_number, otp } });

    if (!user) {
      return res.status(400).send('Invalid or expired OTP');
    }

    // Mark the user as verified
    await user.update({ is_verified: true });

    // Create a JWT token with the user_id
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '20d' });


    

    // Send the token in the response along with the success message
    res.json({
      message: 'OTP verified successfully',
      token: token
    });
  } catch (error) {
    res.status(400).json({status: false, message: error.message});
  }
};


exports.login = async (req, res) => {

  const { identifier } = req.body;

  try {
    // Check if identifier is username or mobile number
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { mobile_number: identifier }
        ]
      }
    });

    if (!user) return res.status(404).json({status: false, message: "User not found"});

    // Generate a unique OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await user.update({ otp, otpExpires: new Date(Date.now() + 3600000) }); // 1 hour expiry

    // Send OTP via SMS
    sendSMS(user.mobile_number, `Your OTP is ${otp}`);

    res.status(200).json({
      status: true,
      message: `OTP sent successfully ${otp}`
    });
  } catch (error) {
    res.status(400).json({status: false, message: error.message});
  }

}


