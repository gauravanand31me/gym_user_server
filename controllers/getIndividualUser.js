const FriendRequest = require('../models/FriendRequest');
const UserAddress = require('../models/UserAddress');
const UserImage = require('../models/UserImages');
const User = require('../models/User');
// controllers/userController.js
const upload = require('../middleware/upload'); // Adjust path as necessary
const { Op, Sequelize } = require('sequelize');

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
    const userId = req.query.id || req.user.id;

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








// Function to search users by username or location
exports.searchUsersByUsernameOrLocation = async (req, res) => {
    const { username } = req.params;
    const loggedInUserId = req.user.id;
    const { latitude, longitude } = req.query;

    try {
        let users;

        if (username) {
            // Search users by username or full name, excluding the logged-in user
            users = await User.findAll({
                where: {
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { username: { [Op.iLike]: `%${username}%` } },
                                { full_name: { [Op.iLike]: `%${username}%` } }
                            ]
                        },
                        { id: { [Op.ne]: loggedInUserId } } // Exclude logged-in user
                    ]
                }
            });
        } else {
            // Search nearby users based on latitude and longitude, excluding the logged-in user
            const nearbyUsers = await UserAddress.findAll({
                where: {
                    is_selected: true,
                    user_id: { [Op.ne]: loggedInUserId },
                },
                include: [{
                    model: User,
                    required: true,
                }],
            });

            // Calculate distances for nearby users
            const usersWithDistances = nearbyUsers.map(userAddress => {
                const distance = getDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    userAddress.lat,
                    userAddress.long
                );
                return {
                    user: userAddress.User,
                    distance,
                };
            });

            // Sort users by distance
            usersWithDistances.sort((a, b) => a.distance - b.distance);

            // Map users excluding the logged-in user
            users = usersWithDistances.map(u => u.user);
        }

        if (!users.length) {
            return res.status(404).json({ message: "No users found" });
        }

        const userIds = users.map(user => user.id);

        // Find friend requests sent by the logged-in user to the found users
        const sentRequests = await FriendRequest.findAll({
            where: {
                fromUserId: loggedInUserId,
                toUserId: { [Op.in]: userIds },
            }
        });

        // Find friend requests received by the logged-in user from the found users
        const receivedRequests = await FriendRequest.findAll({
            where: {
                fromUserId: { [Op.in]: userIds },
                toUserId: loggedInUserId,
            }
        });

        // Map sent and received friend request statuses by user ID
        const requestStatuses = {};
        
        sentRequests.forEach(request => {
            requestStatuses[request.toUserId] = {
                id: request.id,
                sent: request.status === 'pending',
                accepted: request.status === 'accepted',
                received: false
            };
        });

        receivedRequests.forEach(request => {
            if (!requestStatuses[request.fromUserId]) {
                requestStatuses[request.fromUserId] = { sent: false, accepted: false };
            }
            requestStatuses[request.fromUserId].received = true;
        });

        // Prepare user data with friend request status
        const responseData = users.map(user => ({
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            profile_pic: user.profile_pic || "https://via.placeholder.com/150",
            friendRequestStatus: requestStatuses[user.id] || { sent: false, accepted: false, received: false },
        }));

        // Return list of users
        res.status(200).json(responseData);
    } catch (error) {
        console.error('Error searching for users:', error);
        res.status(500).send('Server error');
    }
};




exports.uploadProfileImage = async (req, res) => {
    const userId = req.user.id;

    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const profilePicUrl = req.file.location;

        await User.update(
            { profile_pic: profilePicUrl },
            { where: { id: userId } }
        );
        
        res.status(200).json({ message: 'Profile image uploaded successfully', profile_pic: profilePicUrl });
    } catch (error) {
        console.error('Error uploading profile image:', error);
        res.status(500).send('Server error');
    }
};

exports.uploadPostImage = async (req, res) => {
    const userId = req.user.id;

    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const postPicUrl = req.file.location;




        const userImage = new UserImage({
            user_id: userId, // Ensure user_id is sent in the request
            user_image: req.file.location, // S3 URL
            likes_count: 0 // Initial likes count
        });

        await userImage.save(); // Save to the database

        await User.increment('upload_count', { by: 1, where: { id: userId } });
        return res.status(201).json({ message: 'Image uploaded successfully', userImage });

        

        
    } catch (error) {
        console.error('Error uploading profile image:', error);
        res.status(500).send('Server error');
    }
};


exports.getUserImage = async (req, res) => {
    const userId = req.params.userId; // Get user ID from request parameters
    const limit = 12; // Set the limit for pagination
    const page = parseInt(req.query.page) || 1; // Get page number from query, default to 1

    try {
        const offset = (page - 1) * limit; // Calculate offset for pagination

        // Query to get user images with pagination
        const userImages = await UserImage.findAll({
            where: { user_id: userId },
            limit: limit,
            offset: offset,
            order: [['created_on', 'DESC']], // Order by upload date descending
        });

        // Fetch total count of images for pagination
        const totalImages = await UserImage.count({
            where: { user_id: userId },
        });

        // Calculate total pages
        const totalPages = Math.ceil(totalImages / limit);

        return res.status(200).json({
            message: 'Images retrieved successfully',
            userImages,
            totalImages,
            totalPages,
            currentPage: page,
        });
    } catch (error) {
        console.error('Error retrieving user images:', error);
        return res.status(500).json({ message: 'Server error' });
    }
}


exports.updateFullName = async (req, res) => {
    const userId = req.user.id; // Assumes user is authenticated and user ID is available in req.user
    const { full_name } = req.body;

    try {
        // Check if full_name is provided
        if (!full_name || full_name.trim() === "") {
            return res.status(400).json({ message: 'Full name is required' });
        }

        // Update the user's full name in the database
        await User.update(
            { full_name },
            { where: { id: userId } }
        );

        res.status(200).json({ message: 'Full name updated successfully', full_name });
    } catch (error) {
        console.error('Error updating full name:', error);
        res.status(500).json({ message: 'Server error' });
    }
};






