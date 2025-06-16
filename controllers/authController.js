// controllers/userController.js
const User = require('../models/User');
const { sendSMS } = require('../utils/sendSMS');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { isMobileNumber } = require('../helper/helper');
const PushNotification = require('../models/PushNotification');
const { sendSMSINFOBIP } = require('../utils/sendSMSInfoBIP');
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
      profile_pic: "https://d3tfjww6nofv30.cloudfront.net/a4c48204-30be-406c-a4a3-29708fd69aac/1749495872427_profileImage.jpg",
      password,
      otp,

      otpExpires: new Date(Date.now() + 3600000) // 1 hour expiry
    });

    // Send OTP via SMS
    console.log("Mobile otp received", otp);
    sendSMS("+91"+mobile_number, `Welcome to Yupluck! Your OTP for registration is ${otp}. Please use this code to verify your account. Do not share this OTP with anyone. – Yupluck Team`);

    res.status(201).send({
      status: true,
      message: `User registered successfully, please verify your OTP ${otp}`,
      otp: ""
    });
  } catch (error) {
    res.status(400).json({status: false, message: error.message});
  }
};


exports.verifyOTP = async (req, res) => {
  const { mobile_number, otp, expoPushToken } = req.body;

  await PushNotification.destroy({
    where: {}, // No condition, deletes all records
    truncate: true // This will clear the table and reset auto-increment counters
  });

  try {
    // Find the user with the given mobile number and OTP
    const user = await User.findOne({ where: { mobile_number, otp } });
    console.log("user is", user);
    if (!user) {
      return res.status(400).json({status: false, message: 'Invalid or expired OTP'});
    }

    // Mark the user as verified
    await user.update({ is_verified: true });

    // Create a JWT token with the user_id
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '20d' });

    console.log("expoPushToken", expoPushToken);

    const receivedToken = expoPushToken || "NA";

    const notify = await PushNotification.findOne({ where: { userId: user.id } })
    
        if (notify) {
            // If user exists, update the expoPushToken
            notify.expoPushToken = receivedToken;
            await notify.save();
        
        } else {
            // If user doesn't exist, create a new record
          const newToken = new PushNotification({ userId: user.id , expoPushToken: receivedToken });
          await newToken.save();
          
        }
    

    // Send the token in the response along with the success message
    res.json({
      status: true,
      message: 'OTP verified successfully',
      token: token
    });
  } catch (error) {
    console.error("Error is", error);
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

    if (!user) return res.status(404).json({ status: false, message: "User not found" });

    // Check for the specific mobile number
    if (identifier === "7985044034") {
      // Hardcode OTP as 123456
      const otp = "123456";
      await user.update({ otp, otpExpires: new Date(Date.now() + 3600000) }); // 1 hour expiry
      
      return res.status(200).json({
        status: true,
        message: `Test OTP sent successfully ${otp}`,
        otp: "" // Avoid exposing OTP in response
      });
    }

    // Generate a unique OTP for other users
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await user.update({ otp, otpExpires: new Date(Date.now() + 3600000) }); // 1 hour expiry

    // Send OTP via SMS
    console.log("Mobile otp received", otp);
    sendSMS(`+91${user.mobile_number}`, `Your Yupluck OTP is ${otp}. Please use this code to complete your login. Do not share this OTP with anyone. – Yupluck Team`);
    res.status(200).json({
      status: true,
      message: "OTP sent successfully",
      otp: "" // Avoid exposing OTP in response
    });
  } catch (error) {
    res.status(400).json({ status: false, message: error.message });
  }
};


