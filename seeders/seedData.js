const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const UserAddress = require('../models/UserAddress');
const sequelize = require('../config/db');

const seedUsers = async (User) => {
    const users = [];
    for (let i = 0; i < 30; i++) {
        users.push({
            id: uuidv4(),
            username: `user_${i + 1}_${Math.floor(Math.random() * 10000)}`,
            email: `user${i + 1}@example.com`,
            mobile_number: `9876543${i}`,
            password: bcrypt.hashSync('password123', 10),
            full_name: `User ${i + 1}`,
            is_verified: true,
            profile_pic: `https://example.com/user${i + 1}.jpg`,
            upload_date: new Date(),
            followers_count: Math.floor(Math.random() * 1000),
            following_count: Math.floor(Math.random() * 1000),
            upload_count: Math.floor(Math.random() * 100),
            status: Math.floor(Math.random() * 3),
            otp: Math.floor(100000 + Math.random() * 900000),
            total_work_out_time: Math.floor(Math.random() * 5000),
            register_date: new Date(),
            last_active: new Date(),
        });
    }

    await User.bulkCreate(users);
    return users.map(user => user.id);
};

const seedUserAddresses = async (UserAddress, userIds) => {
    const addresses = [];
    for (let i = 0; i < userIds.length; i++) {
        addresses.push({
            user_id: userIds[i],
            lat: 12.9716 + (Math.random() - 0.5) * 0.01, // Random latitude near the base
            long: 77.5946 + (Math.random() - 0.5) * 0.01, // Random longitude near the base
            address_line_1: `${i + 1} Main St`,
            address_line_2: `Near landmark ${i + 1}`,
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: `5600${Math.floor(Math.random() * 100)}`,
            created_on: new Date(),
            is_selected: true,
        });
    }

    await UserAddress.bulkCreate(addresses);
};

// Seed database function remains unchanged
const seedDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        const userIds = await seedUsers(User);
        console.log('Users seeded successfully.');

        await seedUserAddresses(UserAddress, userIds);
        console.log('User Addresses seeded successfully.');

        process.exit(0);
    } catch (error) {
        console.error('Failed to seed the database:', error);
        process.exit(1);
    }
};

seedDatabase();

module.exports = { seedUsers, seedUserAddresses };
