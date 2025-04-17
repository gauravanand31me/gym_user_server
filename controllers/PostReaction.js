const PostReaction = require('../models/PostReaction');
const { sendPushNotification } = require('../config/pushNotification');
const Feed = require('../models/Feed');
const User = require('../models/User');

exports.reactToPost = async (req, res) => {
  const { postId, reactionType } = req.body;
  const userId = req.user.id;

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
      actionMessage = 'added';
    } else if (existingReaction.reactionType === reactionType) {
      // Remove existing reaction
      await existingReaction.destroy();
      actionMessage = 'removed';
    } else {
      // Update existing reaction
      existingReaction.reactionType = reactionType;
      await existingReaction.save();
      actionMessage = 'updated';
    }

    // Don't notify if reacting to own post
    if (userId !== toUserId && actionMessage !== 'removed') {
      // Create notification
      await Notification.create({
        userId: toUserId, // Recipient of notification
        message: `${fromUser.full_name} reacted to your post with ${reactionType} ${REACTIONS_EMOJI[reactionType] || ''}`,
        type: 'postReaction',
        status: 'unread',
        relatedId: postId,
        profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg",
        forUserId: userId,
      });

      // Send push notification
      const notificationData = await PushNotification.findOne({ where: { userId: toUserId } });
      const notificationTitle = {
        title: "New Reaction on Your Post",
        body: `${fromUser.full_name} reacted to your post.`,
      };

      if (notificationData?.expoPushToken) {
        await sendPushNotification(notificationData.expoPushToken, notificationTitle);
      }
    }

    return res.status(200).json({ message: `Reaction ${actionMessage}` });
  } catch (error) {
    console.error('Error reacting to post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

