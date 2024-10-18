const UserAddress = require('../models/UserAddress');
const User = require('../models/User');
const { Op } = require('sequelize');




exports.getNearbyUsers = async (req, res) => {
    const userId = req.user.id;
    
    try {
        // Find all users excluding the current user
        const allUsers = await User.findAll({
            where: {
                id: { [Op.ne]: userId }, // Exclude the current user
            },
            // Add other fields to select if needed
            attributes: ['id', 'name', 'username', 'image', 'pincode', 'city', 'state'],
        });

        // Shuffle the user array to get random users
        const shuffledUsers = allUsers.sort(() => Math.random() - 0.5);

        // Optionally limit the number of random users to return
        const limit = 10; // Set a limit for how many users you want to return
        const randomUsers = shuffledUsers.slice(0, limit);

        res.status(200).json(randomUsers); // Return the random users
    } catch (error) {
        console.error('Error fetching nearby users:', error);
        res.status(500).send('Server error');
    }
};
