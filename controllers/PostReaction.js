const PostReaction = require('../models/PostReaction');
const Reel = require('../models/Reel');
const { sendPushNotification } = require('../config/pushNotification');
const Feed = require('../models/Feed');
const User = require('../models/User');
const Notification = require('../models/Notification');
const PushNotification = require('../models/PushNotification'); // Make sure this model exists

exports.reactToPost = async (req, res) => {
  const { postId, reactionType } = req.body;
  const userId = req.user.id;

  if (reactionType !== 'like') {
    return res.status(400).json({ message: 'Only "like" reaction is supported' });
  }

  try {
    const reel = await Reel.findOne({ where: { id: postId } });
    const feed = await Feed.findOne({ where: { id: postId } });

    if (!reel && !feed) {
      return res.status(404).json({ message: 'Post/Reel not found' });
    }

    const fromUser = await User.findOne({ where: { id: userId } });
    const existingReaction = await PostReaction.findOne({ where: { postId, userId } });

    let actionMessage = '';
    let targetUserId = reel?.userId || feed?.userId;
    let totalLikes = 0;

    if (!existingReaction) {
      await PostReaction.create({ postId, userId, reactionType });

      if (reel) {
        reel.like_count = (reel.like_count || 0) + 1;
        await reel.save();
        totalLikes = reel.like_count;
      }

      if (feed) {
        feed.like_count = (feed.like_count || 0) + 1;
        await feed.save();
        totalLikes = feed.like_count;
      }

      actionMessage = 'added';
    } else if (existingReaction.reactionType === reactionType) {
      await existingReaction.destroy();

      if (reel) {
        reel.like_count = Math.max(0, (reel.like_count || 0) - 1);
        await reel.save();
        totalLikes = reel.like_count;
      }

      if (feed) {
        feed.like_count = Math.max(0, (feed.like_count || 0) - 1);
        await feed.save();
        totalLikes = feed.like_count;
      }

      actionMessage = 'removed';
    } else {
      existingReaction.reactionType = reactionType;
      await existingReaction.save();
      actionMessage = 'updated';
    }

    // Handle Notification
    if (userId !== targetUserId && actionMessage === 'added') {
      const [notification, created] = await Notification.findOrCreate({
        where: {
          userId: targetUserId,
          relatedId: postId,
          type: 'like',
        },
        defaults: {
          fromUserId: userId,
          description: `${fromUser.full_name} liked your post. Total likes: ${totalLikes}`,
          isRead: false,
        },
      });

      if (!created) {
        notification.description = `${fromUser.full_name} and others liked your post. Total likes: ${totalLikes}`;
        notification.updatedAt = new Date();
        notification.isRead = false;
        await notification.save();
      }

      // Optional: Push Notification
      await sendPushNotification({
        userId: targetUserId,
        title: 'New Like',
        body: notification.description,
        data: { postId },
      });

      // Store push notification log
      await PushNotification.create({
        userId: targetUserId,
        title: 'New Like',
        message: notification.description,
        relatedId: postId,
      });
    }

    return res.status(200).json({ message: `Reaction ${actionMessage}` });

  } catch (error) {
    console.error('Error reacting to post/reel:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
