const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
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
const Follow = require('../models/Follow'); // Assuming you have a Follow model defined
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const s3 = require('../config/aws'); // your s3 config
const { sendPushNotification } = require('../config/pushNotification');
const FeedReports = require('../models/FeedReports');

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
    const command = ffmpeg(inputPath)
      .inputOption('-hwaccel auto')
      .outputOptions([
        '-vf', 'fps=30,scale=1280:-2,format=yuv420p',
        '-pix_fmt', 'yuv420p',
        '-vsync', 'vfr',
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-crf', '28',
        '-preset', 'veryfast',
        '-movflags', '+faststart',
        '-f', 'mp4',
      ])
      .on('start', cmd => {
        console.log('🎬 ffmpeg started:', cmd);
      })
      .on('stderr', stderrLine => {
        console.log('⚙️ ffmpeg stderr:', stderrLine);
      })
      .on('end', () => {
        console.log('✅ Video compression complete');
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('❌ ffmpeg failed:', err.message);
        console.error('stdout:', stdout);
        console.error('stderr:', stderr);
        reject(err);
      });

    try {
      command.save(outputPath);
    } catch (err) {
      console.error('💥 Synchronous ffmpeg crash:', err.message);
      reject(err);
    }
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


exports.resetFollowsAndFollowingCount = async (req, res) => {
  try {
    // Step 1: Delete all follow records
    await Follow.destroy({ where: {} });

    // Step 2: Reset only following_count to 0
    await User.update(
      { following_count: 0 },
      { where: {} }
    );

    return res.status(200).json({ message: 'All follows deleted and following_count reset to 0.' });
  } catch (error) {
    console.error('Error resetting follows and following_count:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};





exports.reportFeed = async (req, res) => {
  const { feedId } = req.params;
  const userId = req.user.id; // Assuming you have user authentication

  try {
    // Check if the report already exists
    const existingReport = await FeedReports.findOne({ where: { userId, feedId } });

    if (existingReport) {
      return res.status(400).json({ message: 'You have already reported this feed.' });
    }

    // Create a new report
    await FeedReports.create({ userId, feedId });

    // Increment the report count
    await Feed.increment('report_count', { where: { id: feedId } });

    return res.status(200).json({ message: 'Feed reported successfully.' });
  } catch (error) {
    console.error('Error reporting feed:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.getFollowedUser = async (req, res) => {
  try {
    const fromUserId = req.user.id;        // Logged-in user
    const toUserId = req.params.id;        // Target user

    if (!toUserId) {
      return res.status(400).json({ message: 'Target user ID is required in params' });
    }

    if (fromUserId === toUserId) {
      return res.status(200).json({ isFollowing: false }); // Can't follow self
    }

    const follow = await Follow.findOne({
      where: {
        followerId: fromUserId,
        followingId: toUserId,
      },
    });



    return res.status(200).json({
      isFollowing: !!follow,
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}



exports.unfollowUser = async (req, res) => {
  try {
    const fromUserId = req.user.id;         // Logged-in user
    const toUserId = req.body.toUserId;     // Other user involved in relationship

    if (!toUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ message: 'You cannot unfollow yourself' });
    }

    // Try to delete both cases:
    const deleted = await Follow.destroy({
      where: {
        [Op.or]: [
          { followerId: fromUserId, followingId: toUserId }, // You unfollow them
          { followerId: toUserId, followingId: fromUserId }, // You remove their follow
        ],
      },
    });

    if (deleted) {
      // Adjust counters conditionally
      await Promise.all([
        User.increment('following_count', {
          by: -1,
          where: { id: fromUserId },
        }),
        User.increment('follower_count', {
          by: -1,
          where: { id: toUserId },
        }),
      ]);

      return res.status(200).json({ message: 'Follow relationship removed successfully' });
    } else {
      return res.status(400).json({ message: 'No follow relationship found' });
    }
  } catch (error) {
    console.error('Unfollow error:', error);
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
};




exports.followUser = async (req, res) => {
  try {
    const { toUserId } = req.body;
    const fromUserId = req.user.id; // assuming middleware adds `req.user`

    if (!toUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    if (toUserId === fromUserId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    // Check if already following
    const alreadyFollowing = await Follow.findOne({
      where: {
        followerId: fromUserId,
        followingId: toUserId
      }
    });

    if (alreadyFollowing) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Create follow record
    const newFollow = await Follow.create({
      id: uuidv4(),
      followerId: fromUserId,
      followingId: toUserId
    });
    await User.increment('following_count', { by: 1, where: { id: toUserId } });

    return res.status(201).json({
      message: 'Successfully followed user',
      follow: newFollow
    });
  } catch (error) {
    console.error('Follow error:', error);
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
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
  const { reelId } = req.params;
  const userId = req.user.id;

  if (!reelId) {
    return res.status(400).json({ success: false, message: 'reelId is required.' });
  }

  try {
    // Step 1: Find the Reel from DB
    const reel = await Reel.findOne({ where: { id: reelId } });
    const feed = await Feed.findOne({ where: { id: reelId } });

    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found.' });
    }

    // Step 2: Check ownership
    if (reel.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this reel.' });
    }

    // Step 3: Extract S3 Key from video URL
    const videoUrl = reel.videoUrl;

    const videoUrlParts = videoUrl.split('/');
    const lastTwoParts = videoUrlParts.slice(-2).join('/'); // "reels/123-compressed.mp4"
    const s3Key = lastTwoParts; // this will be your correct S3 Key

    // ✅ Now s3Key is something like "reels/123-compressed.mp4"

    // Step 4: Delete file from S3
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(deleteCommand);

    // Step 5: Delete Reel record from database
    await reel.destroy();
    await feed.destroy();

    await PostReaction.destroy({ where: { postId: reelId } });
    await PostComment.destroy({ where: { postId: reelId } });

    return res.status(200).json({ success: true, message: 'Reel deleted successfully.' });

  } catch (error) {
    console.error('❌ Error deleting reel:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};




exports.streamReelVideo = async (req, res) => {
  const videoKey = req.params['0']; // capture everything after /stream/
  if (!videoKey) {
    return res.status(400).json({ success: false, message: 'Video key is required.' });
  }

  const rangeHeader = req.headers.range;

  try {
    const s3Head = await s3Client.send(new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: videoKey,
    }));

    const videoSize = s3Head.ContentLength;

    // If no Range header is sent, stream the full video with 200 OK
    if (!rangeHeader) {
      const s3Stream = await s3Client.send(new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: videoKey,
      }));

      res.writeHead(200, {
        'Content-Length': videoSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache', // optional
      });

      return s3Stream.Body.pipe(res);
    }

    // Handle partial range request (used for streaming by video players)
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const contentLength = end - start + 1;

    const s3Stream = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: videoKey,
      Range: `bytes=${start}-${end}`,
    }));

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'video/mp4',
    });

    return s3Stream.Body.pipe(res);

  } catch (err) {
    console.error('❌ Error streaming video:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};









exports.uploadReel = async (req, res) => {
  console.log('🤖 AI Promo upload started');

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Video file is required.' });
  }

  const { title, description, postType, hashTags, link } = req.body;
  const userId = req.user.id;

  const uploadedFilePath = req.file.path;
  const compressedFilePath = path.join(__dirname, '../temp', `compressed-${Date.now()}.mp4`);
  const thumbnailPath = path.join(__dirname, '../temp', `thumbnail-${Date.now()}.jpg`);

  try {
    // Step 1: Compress the video
    await compressVideo(uploadedFilePath, compressedFilePath);

    // Step 2: Generate thumbnail
    await new Promise((resolve, reject) => {
      ffmpeg(compressedFilePath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '320x?',
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Step 3: Upload thumbnail to S3
    const thumbnailStream = fs.createReadStream(thumbnailPath);
    const thumbnailKey = `reels/thumbnails/${Date.now()}-thumbnail.jpg`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: thumbnailKey,
      Body: thumbnailStream,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000',
    }));

    const thumbnailUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${thumbnailKey}`;

    // Step 4: Upload compressed video to S3
    const compressedStream = fs.createReadStream(compressedFilePath);
    const s3Key = `reels/${Date.now()}-compressed.mp4`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Body: compressedStream,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000',
    }));

    const videoUrl = `https://yupluck.com/user/api/users/stream-reel/${s3Key}`;

    // Step 5: Save in Reel table
    const createdReel = await Reel.create({
      userId,
      videoUrl,
      thumbnailUrl,
      title: title || null,
      description: description || null,
      postType: postType || 'public',
      isPublic: postType === 'public',
      hashtags: hashTags ? hashTags.split(",") : [],
      link,
      timestamp: new Date(),
    });

    // Step 6: Raw SQL to fetch reel with user info
    const [reels] = await sequelize.query(`
      SELECT 
        r.*, 
        u.id AS "user.id", 
        u.username AS "user.username", 
        u.full_name AS "user.full_name", 
        u.profile_pic AS "user.profile_pic"
      FROM "Reels" r
      LEFT JOIN "Users" u ON r."userId" = u.id
      WHERE r.id = :reelId
    `, {
      replacements: { reelId: createdReel.id },
      type: sequelize.QueryTypes.SELECT,
      nest: true,
    });

    const reel = reels;

    // Step 7: Save in Feed table
    const feed = await Feed.create({
      id: reel.id,
      userId,
      activityType: 'aiPromo',
      title: title || 'AI Promotional Video 🤖',
      description: description || null,
      imageUrl: videoUrl,
      timestamp: new Date(),
      postType: postType || 'public',
    });

    // Step 8: Push notification
    try {
      const fromUser = await PushNotification.findOne({ where: { userId } });

      if (fromUser?.expoPushToken) {
        const notificationTitle = {
          title: "Reel Uploaded Successfully 🎥",
          body: "Your reel has been uploaded successfully.",
        };
        await sendPushNotification(fromUser.expoPushToken, notificationTitle);

        // await Notification.create({
        //             userId: userId, // The user who made the original booking (to be notified)
        //             message: `Your reel is ready. check now.`, // Notification message
        //             type: 'notificationPost', // Notification type
        //             status: 'unread', // Unread by default
        //             relatedId: reel.id, // Related to the bookingId (buddy request)
        //             profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg", // Use default profile pic if not available
        //             forUserId: userId
        // });

        console.log('✅ Push Notification sent.');
      } else {
        console.log('⚠️ No expoPushToken available for user.');
      }
    } catch (notificationError) {
      console.error('❌ Failed to send push notification:', notificationError.message);
    }

    // Final response
    res.status(201).json({ success: true, feed, reel });

  } catch (err) {
    console.error('❌ AI Promo upload failed:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    try { if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath); } catch { }
    try { if (fs.existsSync(compressedFilePath)) fs.unlinkSync(compressedFilePath); } catch { }
    try { if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath); } catch { }
  }
};





exports.incrementViewCount = async (req, res) => {
  const { id } = req.params;

  try {
    const reel = await Reel.findByPk(id);

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    // Increment view_count
    reel.view_count += 1;
    await reel.save();

    return res.status(200).json({
      message: 'View count updated successfully',
      view_count: reel.view_count,
    });
  } catch (error) {
    console.error('Error updating view count:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};





exports.updateFeedVisibility = async (req, res) => {
  const { feedId } = req.params;
  const { newVisibility } = req.body;
  const userId = req.user.id;

  // Validate visibility value
  if (!['public', 'private', 'friends'].includes(newVisibility)) {
    return res.status(400).json({ success: false, message: 'Invalid visibility type.' });
  }

  try {
    const feed = await Feed.findByPk(feedId);

    if (!feed) {
      return res.status(404).json({ success: false, message: 'Feed not found' });
    }

    // Check ownership
    if (feed.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Update feed visibility
    feed.postType = newVisibility;
    await feed.save();

    // If it's an AI promo, also update the associated Reel
    if (feed.activityType === 'aiPromo') {
      const reel = await Reel.findByPk(feed.id); // Assuming feed.id = reel.id
      if (reel) {
        reel.postType = newVisibility;
        await reel.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Visibility updated successfully',
      updatedFeed: feed,
    });
  } catch (error) {
    console.error('Error updating visibility:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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

    const extension = path.extname(req.file.originalname);
    const fileName = `${userId}/${Date.now()}_profileImage${extension}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3.send(uploadCommand);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

    await User.update(
      { profile_pic: fileUrl },
      { where: { id: userId } }
    );

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      profile_pic: fileUrl
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

    const extension = path.extname(req.file.originalname);
    const fileName = `${userId}/${Date.now()}_postImage${extension}`;

    console.log("fileName received", fileName)

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3.send(command);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

    const userImage = await UserImage.create({
      user_id: userId,
      user_image: fileUrl,
      likes_count: 0,
    });

    await User.increment('upload_count', { by: 1, where: { id: userId } });

    return res.status(201).json({
      message: 'Image uploaded successfully',
      userImage,
    });

  } catch (error) {
    console.error('Error uploading post image:', error);
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
  const userId = req.user.id;

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
  g.id AS "gym.id",
  CASE 
    WHEN pr."reactionType" = 'like' THEN true 
    ELSE false 
  END AS "userLiked"
FROM "Feeds" f
LEFT JOIN "Users" u ON u.id = f."userId"
LEFT JOIN "Users" ru ON ru.id = f."relatedUserId"
LEFT JOIN "Gyms" g ON g.id = f."gymId"
LEFT JOIN "PostReactions" pr ON pr."postId" = f.id AND pr."userId" = :userId
WHERE f.id = :id
LIMIT 1;
      `,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { id, userId },
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
  const { user_id, reel_id, category } = req.query;

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

    // Case 1: Specific reel by ID
    if (reel_id) {
      whereConditions = `WHERE r."id" = :reelId`;
      replacements.reelId = reel_id;
    }

    // Case 2: Specific user's reels
    else if (user_id) {
      const isSelf = user_id === loggedInUserId;

      if (isSelf) {
        whereConditions = `WHERE r."userId" = :userId`;
      } else {
        // check if logged-in user is following user_id
        const follow = await Follow.findOne({
          where: {
            followerId: loggedInUserId,
            followingId: user_id,
          },
        });

        if (follow) {
          whereConditions = `
            WHERE r."userId" = :userId
            AND (r."postType" = 'public' OR r."postType" = 'private')
          `;
        } else {
          whereConditions = `
            WHERE r."userId" = :userId
            AND r."postType" = 'public'
          `;
        }
      }

      replacements.userId = user_id;
    }

    // Case 3: Feed for logged-in user
    else {
      // Get who the user is following
      const followings = await Follow.findAll({
        where: { followerId: loggedInUserId },
        attributes: ['followingId'],
      });

      const followingIds = followings.map(f => f.followingId);
      const idsArray = [loggedInUserId, ...followingIds];

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

    // Optional: Category filter
    if (category) {
      whereConditions += ` AND r."hashtags" @> ARRAY[:category]::VARCHAR[]`;
      replacements.category = category;
    }

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

    const result = reels.map(reel => ({
      ...reel,
      canDelete: reel.userId === loggedInUserId,
      canReport: reel.userId !== loggedInUserId,
    }));

    return res.status(200).json({ reels: result });

  } catch (error) {
    console.error('Error fetching reels:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};





exports.getUserFeed = async (req, res) => {
  const userId = req.user.id;

  try {
    // Step 1: Get list of users the current user is following
    const followings = await Follow.findAll({
      where: { followerId: userId },
      attributes: ['followingId'],
    });

    const followingIds = followings.map(f => f.followingId);

    // Include the user's own ID
    const idsArray = [userId, ...followingIds];

    const limit = parseInt(req.query.limit || 10);
    const offset = parseInt(req.query.offset || 0);

    // Step 2: Raw query with postType logic (based on following instead of friends)
    const query = `
  SELECT
    f.*,
    u.full_name AS "user.full_name",
    u.profile_pic AS "user.profile_pic",
    g.id AS "gym.id",
    g.name AS "gym.name",
    f.like_count AS "likeCount",
    f.comment_count AS "commentCount",
    r."videoUrl" AS "videoUrl",
    r."thumbnailUrl" AS "thumbnailUrl",
    CASE WHEN ur."reactionType" = 'like' THEN true ELSE false END AS "userLiked"
  FROM "Feeds" f
  LEFT JOIN "Users" u ON f."userId" = u.id
  LEFT JOIN "Gyms" g ON f."gymId" = g.id
  LEFT JOIN "PostReactions" ur ON f.id = ur."postId" AND ur."userId" = :userId
  LEFT JOIN "Reels" r ON r.id = f.id

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

    if (post.activityType == "aiPromo") {
      const reel = await Reel.findOne({ where: { id: postId } });
      await reel.destroy();
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
  const userId = req.user.id || req.query.user_id;

  try {
    const limit = parseInt(req.query.limit || 10);
    const offset = parseInt(req.query.offset || 0);

    const query = `
      SELECT
        f.*,
        u.full_name AS "user.full_name",
        u.profile_pic AS "user.profile_pic",
        g.name AS "gym.name",
        COUNT(r."id") AS "reactionCount",
        r2."videoUrl" AS "videoUrl",
        r2."thumbnailUrl" AS "thumbnailUrl"
      FROM "Feeds" f
      LEFT JOIN "Users" u ON f."userId" = u.id
      LEFT JOIN "Gyms" g ON f."gymId" = g.id
      LEFT JOIN "PostReactions" r ON f."id" = r."postId"
      LEFT JOIN "Reels" r2 ON r2."id" = f."id"
      WHERE f."userId" = :userId
      GROUP BY f.id, u.id, g.id, r2."id"
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

    let imageUrl = null;

    if (req.file) {
      const extension = path.extname(req.file.originalname);
      const fileName = `${userId}/${Date.now()}_feedImage${extension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3.send(command);

      imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
    }

    const feed = await Feed.create({
      userId,
      activityType: 'questionPrompt',
      title: 'User Shared a Thought 💬',
      description: answer,
      imageUrl,
      timestamp: new Date(),
      postType: postType || 'public',
    });

    res.status(201).json({ success: true, feed });
  } catch (err) {
    console.error('❌ Feed upload failed:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


exports.getAllCategory = (req, res) => {
  const allCategories = [
    // Popular workout types
    'Chest Day', 'Leg Day', 'Back Day', 'Push Day', 'Pull Day', 'Arm Day', 'Shoulder Day',
    'Abs Blast', 'HIIT Session', 'Strength Training', 'Powerlifting', 'CrossFit', 'Bodybuilding',
    'Cardio Blast', 'Cycling Pump', 'Treadmill Run', 'Rowing Session', 'Zumba', 'Dance Workout',

    // Body focus
    'Full Body', 'Upper Body', 'Lower Body', 'Core Strength', 'Glutes Focus', 'Hamstring Stretch',
    'Quads Burn', 'Calf Training', 'Obliques Builder', 'Neck Mobility', 'Forearm Pump',

    // Equipment-based
    'Bodyweight Only', 'Resistance Bands', 'Dumbbells Only', 'Barbell Only', 'Kettlebell Burn',
    'TRX Workout', 'No Equipment', 'Foam Roller Recovery', 'Weighted Vest Challenge',

    // Skill level
    'Beginner Friendly', 'Intermediate Training', 'Advanced Beast Mode', 'Pro Athlete',
    'First Timer', 'Getting Back', 'Post Injury Workout',

    // Goals
    'Fat Loss', 'Muscle Gain', 'Weight Maintenance', 'Calorie Burn', 'Shredding', 'Bulking',
    'Endurance Boost', 'Strength Gains', 'Flexibility Boost', 'Mobility Routine', 'Speed Training',

    // Routines & programs
    '5x5 Program', 'Push Pull Legs', 'Full Body Split', 'Arnold Split', 'Home Workout Plan',
    'Gym Beast', 'Morning Routine', 'Evening Burn', 'Night Owl Training', 'Quick 20 Minutes',
    'Stretch & Chill', 'Cool Down', 'Warm Up', 'Active Recovery',

    // Styles
    'Tabata', 'Pilates', 'Yoga Flow', 'Vinyasa Yoga', 'Hatha Yoga', 'Power Yoga',
    'Mobility Drills', 'Functional Fitness', 'Isometric Holds', 'Explosive Training',

    // Sports specific
    'Boxing Drills', 'Kickboxing Combo', 'MMA Conditioning', 'Athlete Mode', 'Football Drills',
    'Basketball Training', 'Tennis Warm-Up', 'Cricket Agility',

    // Fun or niche
    'Outdoor Workout', 'Beach Pump', 'Rainy Day Grind', 'Garage Gym', 'Office Workout',
    'Partner Workout', 'Group Class', 'Virtual Trainer', 'Mind-Muscle Connection',

    // Lifestyle/others
    'Post Workout Stretch', 'Pre Workout Routine', 'Cheat Day Burn', 'Challenge Accepted',
    'No Excuses', 'Consistency Wins', 'Discipline > Motivation', 'New PR!', 'Progress Over Perfection'
  ];

  res.status(201).json(allCategories);
}









