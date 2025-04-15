const FriendRequest = require('../models/FriendRequest');
const UserAddress = require('../models/UserAddress');
const UserImage = require('../models/UserImages');
const User = require('../models/User');
// controllers/userController.js
const upload = require('../middleware/upload'); // Adjust path as necessary
const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/db');
const Booking = require('../models/Booking');
const BookingRating = require('../models/BookingRating');
const BuddyRequest = require('../models/BuddyRequest');
const PushNotification = require('../models/PushNotification');
const Notification = require('../models/Notification');
const Feed = require('../models/Feed');

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
                                { username: { [Op.iLike]: `%${username}%` } }
                                
                            ]
                        },
                        { id: { [Op.ne]: loggedInUserId } } // Exclude logged-in user
                    ]
                }
            });
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
                requestStatuses[request.fromUserId] = { id: request.id, sent: false, accepted: false };
            }
            requestStatuses[request.fromUserId].received = true;
        });

        // Prepare user data with friend request status
        const responseData = users.map(user => ({
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            profile_pic: user.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
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
  
      // Update user's profile picture
      await User.update(
        { profile_pic: profilePicUrl },
        { where: { id: userId } }
      );
  
      // ✅ Respond immediately
      res.status(200).json({
        message: 'Profile image uploaded successfully',
        profile_pic: profilePicUrl
      });
  
      // ✅ Log feed entry in background (non-blocking)
      Feed.create({
        userId,
        activityType: 'general',
        title: 'Profile Picture Updated',
        description: 'Updated their profile image 📸',
        imageUrl: profilePicUrl,
        timestamp: new Date()
      })
      .then(() => {
        console.log('✅ Feed entry created successfully (non-blocking)');
      })
      .catch(err => {
        console.error('❌ Feed creation failed (non-blocking):', err.message);
      });
  
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

exports.deleteProfileImage = async (req, res) => {
    const userId = req.user.id; // Assumes user is authenticated and user ID is available in req.user
    try {
    await User.update(
        { profile_pic: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png" },
        { where: { id: userId } }
    );
        res.status(200).json({ message: 'Full name updated successfully', profile_pic: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png" });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
}


exports.deleteProfile = async (req, res) => {
    const { id } = req.user; // Assuming `id` is the user's ID
  
    try {
      // Wrap everything in a transaction for consistency
      await sequelize.transaction(async (transaction) => {
        // Delete bookings
       
  
        // Delete booking ratings
        await BookingRating.destroy({ where: { userId: id }, transaction });
  
        // Delete buddy requests (from and to)
        await BuddyRequest.destroy({ where: { fromUserId: id }, transaction });
        await BuddyRequest.destroy({ where: { toUserId: id }, transaction });
  
        // Delete friend requests (from and to)
        await FriendRequest.destroy({ where: { fromUserId: id }, transaction });
        await FriendRequest.destroy({ where: { toUserId: id }, transaction });
  
        // Delete notifications
        await Notification.destroy({ where: { userId: id }, transaction });
  
        // Delete push notifications
        await PushNotification.destroy({ where: { userId: id }, transaction });
        await Booking.destroy({ where: { userId: id }, transaction });
        // Finally, delete the user
        await User.destroy({ where: { id }, transaction });
      });
  
      return res.status(200).json({ message: "User profile and related data deleted successfully." });
    } catch (error) {
      console.error("Error deleting user profile:", error);
      return res.status(500).json({ error: "An error occurred while deleting the profile." });
    }
  };
  


  exports.getTopUsersByWorkoutTime = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'full_name', 'profile_pic', 'username', 'total_work_out_time'],
            order: [['total_work_out_time', 'DESC']],
            limit: 10,
        });

        console.log("Users are", users);

        return res.status(200).json({
            success: true,
            message: "Top 10 users retrieved successfully",
            data: users
        });
    } catch (error) {
        console.error('Error fetching top users:', error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch top users",
            error: error.message
        });
    }
};





exports.getUserFeed = async (req, res) => {
    const userId = req.user.id;
  
    try {
      // Step 1: Get accepted buddies
      const buddyRequests = await BuddyRequest.findAll({
        where: {
          status: 'accepted',
          [Op.or]: [
            { fromUserId: userId },
            { toUserId: userId }
          ]
        }
      });
  
      // Step 2: Extract unique friend IDs
      const friendIds = new Set([userId]);
      for (const buddy of buddyRequests) {
        if (buddy.fromUserId !== userId) friendIds.add(buddy.fromUserId);
        if (buddy.toUserId !== userId) friendIds.add(buddy.toUserId);
      }
  
      // Step 3: Raw query to fetch feed + user + gym (if exists)
      const idsArray = Array.from(friendIds);
      const limit = parseInt(req.query.limit || 10);
      const offset = parseInt(req.query.offset || 0);
  
      const query = `
        SELECT
          f.*,
          u.full_name AS "user.full_name",
          u.profile_pic AS "user.profile_pic",
          g.name AS "gym.name"
        FROM "Feeds" f
        LEFT JOIN "Users" u ON f."userId" = u.id
        LEFT JOIN "Gyms" g ON f."gymId" = g.id
        WHERE f."userId" IN (:ids)
        ORDER BY f."timestamp" DESC
        LIMIT :limit OFFSET :offset
      `;
  
      const feedItems = await sequelize.query(query, {
        replacements: {
          ids: idsArray,
          limit,
          offset
        },
        type: sequelize.QueryTypes.SELECT,
        nest: true // for nested result under 'user' and 'gym'
      });
  
      return res.status(200).json({ feed: feedItems });
  
    } catch (error) {
      console.error('Error fetching user feed (raw):', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
};



exports.uploadFeed = async (req, res) => {
    try {
      const { answer } = req.body;
      const userId = req.user.id;

      const imageUrl = req.file ? req.file.location : null;
  
      const feed = await Feed.create({
        userId,
        activityType: 'general',
        title: 'User Shared a Thought 💬',
        description: answer,
        imageUrl,
        timestamp: new Date(),
      });
  
      res.status(201).json({ success: true, feed });
    } catch (err) {
      console.error('❌ Feed upload failed:', err.message);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };








