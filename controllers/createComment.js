const PostComment = require('../models/PostComment');
const User = require('../models/User');
const Feed = require('../models/Feed');
const Reel = require("../models/Reel");
const Notification = require("../models/Notification");
const PushNotification = require('../models/PushNotification');
const { sendPushNotification } = require('../config/pushNotification');


exports.createComment = async (req, res) => {
  const fromUserId = req.user.id;
  const { postId, commentText, parentId, mentions } = req.body;
  let repliedUserId, parentCommentData;

  if (!commentText || !postId) {
    return res.status(400).json({ message: 'postId and commentText are required.' });
  }

  try {
    const post = await Feed.findOne({ where: { id: postId } });
    const reel = await Reel.findOne({ where: { id: postId } });

    if (!post && !reel) {
      return res.status(404).json({ message: 'Post/Reel not found.' });
    }

    const comment = await PostComment.create({
      postId,
      userId: fromUserId,
      commentText,
      parentId: parentId || null,
      timestamp: new Date(),
      mentions: mentions || [], // Store mentions as an array of user IDs
    });

    // If top-level comment, increment comment_count in Feed or Reel
    if (!parentId) {
      if (post) {
        post.comment_count += 1;
        await post.save();
      }
      if (reel) {
        reel.comment_count += 1;
        await reel.save();
      }
    }

    // If replying to another comment, increment comment_reply_count
    if (parentId) {
      const parentComment = await PostComment.findOne({ where: { id: parentId } });
      if (parentComment) {
        parentComment.comment_reply_count += 1;
        await parentComment.save();
        repliedUserId = parentComment.userId;
        parentCommentData = parentComment.commentText;
      }
    }

    // 🔔 Notification Logic for Post/Reel Owner
    const actorUser = await User.findOne({ where: { id: fromUserId } });
    const receiverUserId = post?.userId || reel?.userId;

    if (receiverUserId && receiverUserId !== fromUserId) {
      const existingNotification = await Notification.findOne({
        where: {
          userId: receiverUserId, // 👈 RECEIVER of the notification
          relatedId: postId,
          type: 'comment',
        },
        order: [['updatedAt', 'DESC']],
      });

      if (existingNotification) {
        const othersCount = existingNotification.othersCount || 1;
        const newCount = othersCount + 1;

        existingNotification.message = `${actorUser.full_name} and ${newCount - 1} others commented on your ${reel ? 'reel' : 'post'}`;
        existingNotification.profileImage = actorUser.profile_pic || '';
        existingNotification.forUserId = fromUserId; // 👈 ACTOR
        existingNotification.othersCount = newCount;
        existingNotification.status = "unread";
        existingNotification.createdAt = new Date();
        existingNotification.updatedAt = new Date();

        await existingNotification.save();
      } else {
        await Notification.create({
          userId: receiverUserId, // 👈 RECEIVER
          forUserId: fromUserId,  // 👈 ACTOR
          relatedId: postId,
          type: 'comment',
          profileImage: actorUser.profile_pic || '',
          message: `${actorUser.full_name} commented on your ${reel ? 'reel' : 'post'}`,
          othersCount: 1,
        });
      }

      const notificationData = await PushNotification.findOne({
        where: { userId: receiverUserId }
      });

      const notificationTitle = {
        title: "New Comment",
        body: `${actorUser.full_name} commented on your ${reel ? 'reel' : 'post'}`, // Notification message
      };

      await sendPushNotification(notificationData?.expoPushToken, notificationTitle);
    }

    // 🔔 Notification Logic for Replied-to User
    if (repliedUserId) {
      const repliedActorUser = await User.findOne({ where: { id: repliedUserId } });

      await Notification.create({
        userId: repliedUserId, // 👈 RECEIVER
        forUserId: fromUserId,  // 👈 ACTOR
        relatedId: postId,
        type: 'comment',
        profileImage: actorUser.profile_pic || '',
        message: `${actorUser.full_name} replied to your comment on ${reel ? 'reel' : 'post'} - "${parentCommentData}"`,
        othersCount: 1,
      });
    }

    // 🔔 Notification Logic for Mentioned Users
    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      const uniqueMentions = [...new Set(mentions)]; // Remove duplicates
      for (const mentionedUserId of uniqueMentions) {
        if (mentionedUserId !== fromUserId && mentionedUserId !== receiverUserId && mentionedUserId !== repliedUserId) {
          const mentionedUser = await User.findOne({ where: { id: mentionedUserId } });
          if (mentionedUser) {
            await Notification.create({
              userId: mentionedUserId, // 👈 RECEIVER
              forUserId: fromUserId,  // 👈 ACTOR
              relatedId: postId,
              type: 'comment',
              profileImage: actorUser.profile_pic || '',
              message: `${actorUser.full_name} mentioned you in a ${reel ? 'reel' : 'post'}`,
              othersCount: 1,
            });

            const mentionNotificationData = await PushNotification.findOne({
              where: { userId: mentionedUserId }
            });

            const mentionNotificationTitle = {
              title: "You Were Mentioned",
              body: `${actorUser.full_name} mentioned you in a ${reel ? 'reel' : 'post'}`,
            };

            await sendPushNotification(mentionNotificationData?.expoPushToken, mentionNotificationTitle);
          }
        }
      }
    }

    res.status(201).json({ message: 'Comment added successfully.', comment });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ message: 'Failed to add comment.' });
  }
};



exports.deleteComment = async (req, res) => {
  const userId = req.user.id;
  const { commentId } = req.params;

  try {
    const comment = await PostComment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized to delete this comment.' });
    }

    const post = await Feed.findByPk(comment.postId);
    const reel = await Reel.findByPk(comment.postId);

    // Save parentId before deletion
    const parentId = comment.parentId;

    // Delete the comment
    await comment.destroy();

    if (!parentId) {
      // Top-level comment: decrement post comment count
      if (post) {
        post.comment_count = Math.max(0, post.comment_count - 1);
        await post.save();
        reel.comment_count = Math.max(0, post.comment_count - 1);
        await reel.save();
      }
    } else {
      // Reply: decrement replies_count of the parent comment
      const parentComment = await PostComment.findByPk(parentId);
      if (parentComment) {
        parentComment.replies_count = Math.max(0, parentComment.replies_count - 1);
        await parentComment.save();
      }
    }

    return res.status(200).json({ message: 'Comment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({ message: 'Failed to delete comment.' });
  }
};




exports.getCommentsByPost = async (req, res) => {
  const { postId } = req.params;
  const { parentId } = req.query; // optional query param

  if (!postId) {
    return res.status(400).json({ message: 'postId is required.' });
  }

  try {
    const whereClause = {
      postId,
      parentId: parentId || null, // null for top-level comments
    };

    const comments = await PostComment.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          attributes: ['id', 'full_name', 'profile_pic'],
        },
      ],
    });

    const enhancedComments = comments.map((comment) => {
      const commentJson = comment.toJSON();
      commentJson.canDelete = comment.userId === req.user.id;
      return commentJson;
    });

    return res.status(200).json({ comments: enhancedComments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ message: 'Failed to fetch comments.' });
  }
};

