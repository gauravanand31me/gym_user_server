// controllers/userController.js
const User = require('../models/User');
const { sendSMS } = require('../utils/sendSMS');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { isMobileNumber } = require('../helper/helper');
const PushNotification = require('../models/PushNotification');
const JWT_SECRET = process.env.JWT_SECRET || "Test@1992"
// Register a new user
exports.register = async (req, res) => {
  const { full_name, mobile_number } = req.body;

  // Hardcoded password (you can replace it with a more secure method if needed)
  const password = 'hardcodedPassword123';
  const confirmPassword = password; // No need to confirm in this case

  if (!isMobileNumber(mobile_number)) {
    return res.status(400).json({status: false, message: 'Please enter valid mobile number.'});
  }
  // Generate a unique OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    const username = full_name.toLowerCase().replace(/\s+/g, '')+"_"+randomNumber
    // Check for existing user
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { mobile_number },
          { username: username}
        ]
      }
    });
    
    if (existingUser) return res.status(400).json({status: false, message: 'Mobile number or username already exists'});

    // Create a new user
    
    const user = await User.create({
      full_name,
      username: username,
      mobile_number,
      password,
      otp,
      otpExpires: new Date(Date.now() + 3600000) // 1 hour expiry
    });

    // Send OTP via SMS
    sendSMS("+91"+mobile_number, `Your OTP is ${otp}`);

    res.status(201).send({
      status: true,
      message: `User registered successfully, please verify your OTP ${otp}`,
      otp: otp
    });
  } catch (error) {
    res.status(400).json({status: false, message: error.message});
  }
};


exports.verifyOTP = async (req, res) => {
  const { mobile_number, otp, expoPushToken } = req.body;

  console.log("expoPushToken", expoPushToken);

  try {
    // Find the user with the given mobile number and OTP
    const user = await User.findOne({ where: { mobile_number, otp } });

    if (!user) {
      return res.status(400).json({status: false, message: 'Invalid or expired OTP'});
    }

    // Mark the user as verified
    await user.update({ is_verified: true });

    // Create a JWT token with the user_id
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '20d' });

   

    const notify = await PushNotification.findOne({ userId: user.id });

        if (notify) {
            // If user exists, update the expoPushToken
            notify.expoPushToken = expoPushToken;
            await notify.save();
        
        } else {
            // If user doesn't exist, create a new record
          const newToken = new User({ userId: user.id , expoPushToken });
          await newToken.save();
          
        }
    

    // Send the token in the response along with the success message
    res.json({
      status: true,
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
    sendSMS("+91"+user.mobile_number, `Your OTP is ${otp}`);

    res.status(200).json({
      status: true,
      message: `OTP sent successfully ${otp}`,
      otp
    });
  } catch (error) {
    res.status(400).json({status: false, message: error.message});
  }

}


