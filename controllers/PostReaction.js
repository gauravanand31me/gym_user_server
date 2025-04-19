const PostReaction = require('../models/PostReaction');
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
    const post = await Feed.findOne({ where: { id: postId } });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const toUserId = post.userId;
    const fromUser = await User.findOne({ where: { id: userId } });

    const existingReaction = await PostReaction.findOne({ where: { postId, userId } });

    let actionMessage = '';

    if (!existingReaction) {
      // Create new reaction
      await PostReaction.create({ postId, userId, reactionType });

      // Increment like_count
      post.like_count += 1;
      await post.save();

      actionMessage = 'added';
    } else if (existingReaction.reactionType === reactionType) {
      // Remove reaction
      await existingReaction.destroy();

      // Decrement like_count (ensure not negative)
      post.like_count = Math.max(0, post.like_count - 1);
      await post.save();

      actionMessage = 'removed';
    } else {
      // If needed to support switching reaction types in the future
      existingReaction.reactionType = reactionType;
      await existingReaction.save();
      actionMessage = 'updated';
    }

    // Send notification (if not reacting to own post and it's not a removal)
    if (userId !== toUserId && actionMessage !== 'removed') {
      await Notification.create({
        userId: toUserId,
        message: `${fromUser.full_name} liked your post ❤️`,
        type: 'postReaction',
        status: 'unread',
        relatedId: postId,
        profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg",
        forUserId: userId,
      });

      const notificationData = await PushNotification.findOne({ where: { userId: toUserId } });
      const notificationTitle = {
        title: "New Like on Your Post",
        body: `${fromUser.full_name} liked your post.`,
      };

      if (notificationData?.expoPushToken) {
        await sendPushNotification(notificationData.expoPushToken, notificationTitle);
      }
    }

    return res.status(200).json({ message: `Reaction ${actionMessage}` });
  } catch (error) {
    console.error('Error reacting to post:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
