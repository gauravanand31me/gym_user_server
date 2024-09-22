const UserAddress = require('../models/UserAddress');
const User = require('../models/User');
const { Op } = require('sequelize');

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
};


exports.getNearbyUsers = async (req, res) => {
    const userId = req.user.id;

    // Fetch the current location of the logged-in user
    const currentLocation = await UserAddress.findOne({
        where: {
            user_id: userId,
            is_selected: true,
        },
    });

    if (!currentLocation) {
        return res.status(400).send('User location is required');
    }

    const { lat: userLat, long: userLong } = currentLocation;
    
    try {
        // Find all nearby users
        const nearbyUsers = await UserAddress.findAll({
            where: {
                is_selected: true,
                user_id: { [Op.ne]: userId }, // Exclude the current user
            },
            include: [{
                model: User,
                required: true,
            }],
        });

        // Calculate distances and sort users
        const usersWithDistances = nearbyUsers.map(user => {
            const distance = getDistance(userLat, userLong, user.lat, user.long);
            return {
                user,
                distance,
            };
        });

        // Sort users by distance first, then by pincode, then by city/state
        usersWithDistances.sort((a, b) => {
            if (a.distance === b.distance) {
                // Replace with actual comparison logic for pincode, city, and state
                return a.user.pincode.localeCompare(b.user.pincode) ||
                       a.user.city.localeCompare(b.user.city) ||
                       a.user.state.localeCompare(b.user.state);
            }
            return a.distance - b.distance; // Ascending order of distance
        });

        res.status(200).json(usersWithDistances.map(u => u.user)); // Return sorted users
    } catch (error) {
        console.error('Error fetching nearby users:', error);
        res.status(500).send('Server error');
    }
};
