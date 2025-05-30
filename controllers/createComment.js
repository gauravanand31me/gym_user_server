const PostComment = require('../models/PostComment');
const User = require('../models/User');
const Feed = require('../models/Feed');
const Reel = require("../models/Reel");

exports.createComment = async (req, res) => {
  const userId = req.user.id;
  const { postId, commentText, parentId } = req.body;

  if (!commentText || !postId) {
    return res.status(400).json({ message: 'postId and commentText are required.' });
  }

  try {
    const post = await Feed.findOne({ where: { id: postId } });
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const comment = await PostComment.create({
      postId,
      userId,
      commentText,
      parentId: parentId || null,
      timestamp: new Date(),
    });

    // Increment Feed's comment count
    if (!parentId) {
      post.comment_count += 1;
      await post.save();
    }

    // If parentId exists, increment reply count on parent comment
    if (parentId) {
      const parentComment = await PostComment.findOne({ where: { id: parentId } });
      if (parentComment) {
        parentComment.comment_reply_count += 1;
        await parentComment.save();
      }
    }

    // Also check and update comment count in Reel if exists
    const reel = await Reel.findOne({ where: { id: postId } });
    if (reel) {
      reel.comment_count += 1;
      await reel.save();
    }

    return res.status(201).json({ message: 'Comment added successfully.', comment });
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

    // Save parentId before deletion
    const parentId = comment.parentId;

    // Delete the comment
    await comment.destroy();

    if (!parentId) {
      // Top-level comment: decrement post comment count
      if (post) {
        post.comment_count = Math.max(0, post.comment_count - 1);
        await post.save();
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

