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
    // Find Reel (may or may not exist)
    const reel = await Reel.findOne({ where: { id: postId } });

    // Find Feed (may or may not exist)
    const feed = await Feed.findOne({ where: { id: postId } });

    if (!reel && !feed) {
      return res.status(404).json({ message: 'Post/Reel not found' });
    }

    const fromUser = await User.findOne({ where: { id: userId } });

    // Check if the user already reacted
    const existingReaction = await PostReaction.findOne({ where: { postId, userId } });

    let actionMessage = '';
    console.log("existingReaction", existingReaction);
    if (!existingReaction) {
      // New like
      await PostReaction.create({ postId, userId, reactionType });

      if (reel) {
        console.log("(reel.like_count || 0) + 1", (reel.like_count || 0) + 1);
        reel.like_count = (reel.like_count || 0) + 1;
        await reel.save();
      }

      if (feed) {
        feed.like_count = (feed.like_count || 0) + 1;
        await feed.save();
      }

      actionMessage = 'added';
    } else if (existingReaction.reactionType === reactionType) {
      // Remove like
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
      // If other reactions are added in future
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