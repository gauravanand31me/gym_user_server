const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const User = require('../models/User');
const sequelize = require('../config/db');

const MOBILE = '2125550191';
const OTP    = 123456;

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Remove any leftover demo records that might conflict
    await User.destroy({
      where: {
        [Op.or]: [
          { mobile_number: MOBILE },
          { username: 'demo_user_us' },
          { email: 'demo@yupluck.com' },
        ],
      },
    });

    const data = {
      username:      'demo_user_us',
      email:         'demo@yupluck.com',
      mobile_number: MOBILE,
      password:      bcrypt.hashSync('Demo@1234', 10),
      full_name:     'Demo User',
      is_verified:   true,
      otp:           OTP,
      status:        0,
      register_date: new Date(),
      last_active:   new Date(),
    };

    // Only set country if the column already exists
    try {
      const cols = await sequelize.getQueryInterface().describeTable('Users');
      if (cols.country) data.country = 'US';
    } catch (_) {}

    const user = await User.create(data);

    console.log('Demo user created');
    console.log('---');
    console.log('Mobile  :', MOBILE);
    console.log('OTP     :', OTP);
    console.log('Password: Demo@1234');
    console.log('User ID :', user.id);

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    if (err.errors) err.errors.forEach(e => console.error(' -', e.message));
    process.exit(1);
  }
};

seed();
