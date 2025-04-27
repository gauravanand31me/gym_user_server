const { S3Client, PutObjectCommand, DeleteObjectCommand  } = require('@aws-sdk/client-s3');
const FriendRequest = require('../models/FriendRequest');
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
const PostReaction = require('../models/PostReaction');
const PostComment = require('../models/PostComment');
const Reel = require('../models/Reel'); 
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const s3 = require('../config/aws'); // your s3 config

const s3Client = new S3Client({ 
  region: process.env.AWS_REGION, 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

ffmpeg.setFfmpegPath(ffmpegPath);


const compressVideo = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vcodec libx264',
        '-crf 28',
        '-preset fast',
        '-movflags +faststart'
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
};



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


exports.deleteReel = async (req, res) => {
  const { reelId } = req.params; // Get reelId from route params
  const userId = req.user.id; // Logged-in user

  console.log("Reel id received", reelId);

  if (!reelId) {
    return res.status(400).json({ success: false, message: 'reelId is required.' });
  }

  try {
    // Step 1: Find the Reel from DB
    const reel = await Reel.findOne({ where: { id: reelId } });

    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found.' });
    }

    // Step 2: Check ownership
    if (reel.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this reel.' });
    }

    // Step 3: Extract S3 Key from video URL
    const videoUrl = reel.videoUrl;
    const s3UrlPrefix = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/`;

    if (!videoUrl.startsWith(s3UrlPrefix)) {
      return res.status(400).json({ success: false, message: 'Invalid video URL.' });
    }

    const s3Key = videoUrl.replace(s3UrlPrefix, '');

    // Step 4: Delete file from S3
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(deleteCommand);

    // Step 5: Delete Reel record from database
    await reel.destroy();

    return res.status(200).json({ success: true, message: 'Reel deleted successfully.' });

  } catch (error) {
    console.error('❌ Error deleting reel:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


exports.uploadReel = async (req, res) => {
  console.log('🎥 Video upload started');
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Video file is required.' });
  }

  const { title, description, postType } = req.body;
  const userId = req.user.id;

  const uploadedFilePath = req.file.path; // Temporary local uploaded video
  const compressedFilePath = path.join(__dirname, '../temp', `compressed-${Date.now()}.mp4`);

  try {
    // Step 1: Compress the video
    await compressVideo(uploadedFilePath, compressedFilePath);

    // Step 2: Upload compressed video to S3
    const compressedStream = fs.createReadStream(compressedFilePath);
    const s3Key = `reels/${Date.now()}-compressed.mp4`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Body: compressedStream,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000',
    });

    await s3Client.send(command);

    const videoUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;

    // Step 3: Save in Database
    const reel = await Reel.create({
      userId,
      videoUrl,
      title: title || null,
      description: description || null,
      postType: postType || 'public',
      isPublic: postType === 'public',
      timestamp: new Date(),
    });

    res.status(201).json({ success: true, reel });

  } catch (err) {
    console.error('❌ Reel upload failed:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    // Always cleanup temp files even if upload failed
    try { if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath); } catch {}
    try { if (fs.existsSync(compressedFilePath)) fs.unlinkSync(compressedFilePath); } catch {}
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


exports.getFeedById = async (req, res) => {
  const { id } = req.params;

  try {
    const feedResult = await sequelize.query(
      `
      SELECT
        f.*,
        u.full_name AS "user.full_name",
        u."profile_pic" AS "user.profilePic",
        u.id AS "user.id",
        ru.full_name AS "relatedUser.full_name",
        ru.id AS "relatedUser.id",
        g.name AS "gym.name",
        g.id AS "gym.id"
      FROM "Feeds" f
      LEFT JOIN "Users" u ON u.id = f."userId"
      LEFT JOIN "Users" ru ON ru.id = f."relatedUserId"
      LEFT JOIN "Gyms" g ON g.id = f."gymId"
      WHERE f.id = :id
      LIMIT 1
      `,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { id },
        raw: true,
        nest: true, // to allow nested objects like user, gym, etc.
      }
    );

    const feed = feedResult[0];

    if (!feed) return res.status(404).json({ message: 'Feed not found' });

    res.json(feed);
  } catch (err) {
    console.error('Error fetching feed by ID (raw):', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.getUserReels = async (req, res) => {
  const loggedInUserId = req.user.id;
  const { user_id, reel_id } = req.query; // user_id = whose reels to fetch (optional)

  try {
    const limit = parseInt(req.query.limit || 10);
    const offset = parseInt(req.query.offset || 0);

    let query = `
      SELECT
        r.*,
        u.full_name AS "user.full_name",
        u.profile_pic AS "user.profile_pic"
      FROM "Reels" r
      LEFT JOIN "Users" u ON r."userId" = u.id
    `;
    let whereConditions = '';
    let replacements = { limit, offset };

    // 👉 Case 1: If reel_id is passed ➔ fetch specific Reel
    if (reel_id) {
      whereConditions = `WHERE r."id" = :reelId`;
      replacements.reelId = reel_id;
    }
    // 👉 Case 2: If user_id is passed ➔ fetch reels of that user
    else if (user_id) {
      // Check if the requested userId is same as logged-in userId
      const isSelf = (user_id === loggedInUserId);

      if (isSelf) {
        // Fetch all reels uploaded by the user (public, private, onlyme)
        whereConditions = `
          WHERE r."userId" = :userId
        `;
      } else {
        // Fetch only allowed reels (public + private if buddies + onlyme hidden)
        // Step 1: Check if loggedInUserId and user_id are buddies
        const friendRequest = await FriendRequest.findOne({
          where: {
            status: 'accepted',
            [Op.or]: [
              { fromUserId: loggedInUserId, toUserId: user_id },
              { fromUserId: user_id, toUserId: loggedInUserId },
            ]
          }
        });

        const areFriends = !!friendRequest;

        if (areFriends) {
          // if friends ➔ allow 'public' and 'private' reels
          whereConditions = `
            WHERE r."userId" = :userId
            AND (r."postType" = 'public' OR r."postType" = 'private')
          `;
        } else {
          // if not friends ➔ allow only 'public' reels
          whereConditions = `
            WHERE r."userId" = :userId
            AND r."postType" = 'public'
          `;
        }
      }
      replacements.userId = user_id;
    }
    // 👉 Case 3: Default case ➔ fetch feed (friends + public reels)
    else {
      // Step 1: Get accepted buddies
      const friendRequest = await FriendRequest.findAll({
        where: {
          status: 'accepted',
          [Op.or]: [
            { fromUserId: loggedInUserId },
            { toUserId: loggedInUserId }
          ]
        }
      });

      // Step 2: Extract unique friend IDs
      const friendIds = new Set([loggedInUserId]);
      for (const friend of friendRequest) {
        if (friend.fromUserId !== loggedInUserId) friendIds.add(friend.fromUserId);
        if (friend.toUserId !== loggedInUserId) friendIds.add(friend.toUserId);
      }

      const idsArray = Array.from(friendIds);

      whereConditions = `
        WHERE (
          r."postType" = 'public'
          OR (r."postType" = 'private' AND r."userId" IN (:ids))
          OR (r."postType" = 'onlyme' AND r."userId" = :loggedInUserId)
        )
      `;
      replacements.ids = idsArray;
      replacements.loggedInUserId = loggedInUserId;
    }

    // 👉 Final Query
    query += `
      ${whereConditions}
      ORDER BY r."timestamp" DESC
      LIMIT :limit OFFSET :offset
    `;

    const reels = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
      nest: true,
    });

    const reelsWithPermissions = reels.map(reel => ({
      ...reel,
      canDelete: reel.userId === loggedInUserId,
      canReport: reel.userId !== loggedInUserId,
    }));

    return res.status(200).json({ reels: reelsWithPermissions });

  } catch (error) {
    console.error('Error fetching user reels:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};




exports.getUserFeed = async (req, res) => {
  const userId = req.user.id;

  try {
    // Step 1: Get accepted buddies
    const friendRequest = await FriendRequest.findAll({
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
    for (const friend of friendRequest) {
      if (friend.fromUserId !== userId) friendIds.add(friend.fromUserId);
      if (friend.toUserId !== userId) friendIds.add(friend.toUserId);
    }

    const idsArray = Array.from(friendIds);
    const limit = parseInt(req.query.limit || 10);
    const offset = parseInt(req.query.offset || 0);

    // Step 3: Raw query with postType logic
    const query = `
      SELECT
        f.*,
        u.full_name AS "user.full_name",
        u.profile_pic AS "user.profile_pic",
        g.id AS "gym.id",
        g.name AS "gym.name",
        f.like_count AS "likeCount",
        f.comment_count AS "commentCount",
        CASE WHEN ur."reactionType" = 'like' THEN true ELSE false END AS "userLiked"
      FROM "Feeds" f
      LEFT JOIN "Users" u ON f."userId" = u.id
      LEFT JOIN "Gyms" g ON f."gymId" = g.id
      LEFT JOIN "PostReactions" ur ON f.id = ur."postId" AND ur."userId" = :userId

      WHERE (
          f."postType" = 'public'
          OR (f."postType" = 'private' AND f."userId" IN (:ids))
          OR (f."postType" = 'onlyme' AND f."userId" = :userId)
      )
      ORDER BY f."timestamp" DESC
      LIMIT :limit OFFSET :offset
    `;

    const feedItems = await sequelize.query(query, {
      replacements: { ids: idsArray, limit, offset, userId },
      type: sequelize.QueryTypes.SELECT,
      nest: true,
    });

    const feedItemsWithPermissions = feedItems.map(feed => ({
      ...feed,
      canDelete: feed.userId === userId,
      canReport: feed.userId !== userId,
    }));

    return res.status(200).json({ feed: feedItemsWithPermissions });

  } catch (error) {
    console.error('Error fetching user feed:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};




// DELETE /posts/:postId
exports.deletePost = async (req, res) => {
  const userId = req.user.id;
  const postId = req.params.postId;

  try {
    // Step 1: Find the post
    const post = await Feed.findOne({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Step 2: Verify that the logged-in user owns the post
    if (post.userId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this post' });
    }

    // Step 3: Delete associated reactions
    await PostReaction.destroy({ where: { postId } });
    await PostComment.destroy({ where: { postId } });
    // Step 4: Delete the post
    await post.destroy();

    return res.status(200).json({ message: 'Post and associated reactions deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};




exports.getMyFeed = async (req, res) => {
  const userId = req.user.id;

  try {
    const limit = parseInt(req.query.limit || 10);
    const offset = parseInt(req.query.offset || 0);

    const query = `
        SELECT
          f.*,
          u.full_name AS "user.full_name",
          u.profile_pic AS "user.profile_pic",
          g.name AS "gym.name",
          COUNT(r."id") AS "reactionCount"
        FROM "Feeds" f
        LEFT JOIN "Users" u ON f."userId" = u.id
        LEFT JOIN "Gyms" g ON f."gymId" = g.id
        LEFT JOIN "PostReactions" r ON f."id" = r."postId"
        WHERE f."userId" = :userId
        GROUP BY f.id, u.id, g.id
        ORDER BY f."timestamp" DESC
        LIMIT :limit OFFSET :offset
      `;

    const feedItems = await sequelize.query(query, {
      replacements: { userId, limit, offset },
      type: sequelize.QueryTypes.SELECT,
      nest: true,
    });

    return res.status(200).json({ feed: feedItems });

  } catch (error) {
    console.error('Error fetching my posts feed:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



exports.uploadFeed = async (req, res) => {
  try {
    const { answer, postType } = req.body;
    const userId = req.user.id;

    const imageUrl = req.file ? req.file.location : null;

    console.log("image url received", imageUrl);

    const feed = await Feed.create({
      userId,
      activityType: 'questionPrompt',
      title: 'User Shared a Thought 💬',
      description: answer,
      imageUrl,
      timestamp: new Date(),
      postType: postType || 'public' // 👈 default to 'public' if not provided
    });

    res.status(201).json({ success: true, feed });
  } catch (err) {
    console.error('❌ Feed upload failed:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};









