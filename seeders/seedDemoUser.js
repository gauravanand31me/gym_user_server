const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const sequelize = require('../config/db');

const DEMO_USER = {
  username:       'demo_user_us',
  email:          'demo@yupluck.com',
  mobile_number:  '2125550191',     // USA (212) fictional number, no country code
  password:       bcrypt.hashSync('Demo@1234', 10),
  full_name:      'Demo User',
  is_verified:    true,
  otp:            123456,           // fixed OTP for testing
  country:        'US',
  status:         0,
  register_date:  new Date(),
  last_active:    new Date(),
};

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    const [user, created] = await User.findOrCreate({
      where:    { mobile_number: DEMO_USER.mobile_number },
      defaults: DEMO_USER,
    });

    if (created) {
      console.log('Demo user created');
    } else {
      console.log('Demo user already exists — skipping');
    }

    console.log('---');
    console.log('Mobile : 2125550191');
    console.log('OTP    : 123456');
    console.log('Password: Demo@1234');
    console.log('User ID:', user.id);

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
