const FriendRequest = require('../models/FriendRequest');
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

exports.getIndividualUser = async (req, res) => {
    const userId = req.user.id;

    try {
        // Fetch the logged-in user's information
        const loggedInUser = await User.findByPk(userId);

       
        // Return logged-in user's info along with nearby users
        res.status(200).json({
            loggedInUser: {
                ...loggedInUser.toJSON()
            }
            
        });

    } catch (error) {
        console.error('Error fetching nearby users:', error);
        res.status(500).send('Server error');
    }
};




exports.searchUserByUsername = async (req, res) => {
    const { username } = req.params;
    const loggedInUserId = req.user.id;

    try {
        const user = await User.findOne({
            where: {
                username: { [Op.iLike]: username }, // Case insensitive match
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check for existing friend requests (pending and accepted)
        const sentRequest = await FriendRequest.findOne({
            where: {
                fromUserId: loggedInUserId,
                toUserId: user.id,
                status: 'pending',
            },
        });

        const acceptedRequest = await FriendRequest.findOne({
            where: {
                fromUserId: loggedInUserId,
                toUserId: user.id,
                status: 'accepted',
            },
        });

        // Prepare user data with friend request status
        const responseData = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            profile_pic: user.profile_pic || "https://via.placeholder.com/150",
            friendRequestStatus: {
                sent: !!sentRequest, // true if a pending request exists
                accepted: !!acceptedRequest, // true if an accepted request exists
            },
        };

        res.status(200).json(responseData);
    } catch (error) {
        console.error('Error searching for user:', error);
        res.status(500).send('Server error');
    }
};



