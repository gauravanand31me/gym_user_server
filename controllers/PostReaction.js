const PostReaction = require('../models/PostReaction');
const Reel = require('../models/Reel');
const Feed = require('../models/Feed');
const User = require('../models/User');
const Notification = require('../models/Notification');

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
    const toUserId = reel?.userId || feed?.userId;

    const existingReaction = await PostReaction.findOne({ where: { postId, userId } });

    let actionMessage = '';

    if (!existingReaction) {
      // New like
      await PostReaction.create({ postId, userId, reactionType });

      if (reel) {
        reel.like_count = (reel.like_count || 0) + 1;
        await reel.save();
      }

      if (feed) {
        feed.like_count = (feed.like_count || 0) + 1;
        await feed.save();
      }

      actionMessage = 'added';

      // 🔔 Create or update notification
      if (toUserId && toUserId !== userId) {
        const existingNotification = await Notification.findOne({
          where: {
            userId: toUserId,
            forUserId: userId,
            relatedId: postId,
            type: 'reaction',
          },
        });

        if (existingNotification) {
          // Just update the timestamp
          existingNotification.status = "unread";
          existingNotification.updatedAt = new Date();
          await existingNotification.save();
        } else {
          // Create new notification
          await Notification.create({
            userId: toUserId,
            forUserId: userId,
            message: `${fromUser.full_name} liked your ${reel ? 'reel' : 'post'}`,
            type: 'reaction',
            profileImage: fromUser.profile_pic || '',
            relatedId: postId,
          });
        }
      }

    } else if (existingReaction.reactionType === reactionType) {
      // Unlike (remove reaction)
      await existingReaction.destroy();

      if (reel) {
        reel.like_count = Math.max(0, (reel.like_count || 0) - 1);
        await reel.save();
      }

      if (feed) {
        feed.like_count = Math.max(0, (feed.like_count || 0) - 1);
        await feed.save();
      }

      actionMessage = 'removed';
    } else {
      // (Future: if more reaction types are supported)
      existingReaction.reactionType = reactionType;
      await existingReaction.save();
      actionMessage = 'updated';
    }

    return res.status(200).json({ message: `Reaction ${actionMessage}` });

  } catch (error) {
    console.error('Error reacting to post/reel:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
