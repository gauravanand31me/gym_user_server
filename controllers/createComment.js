const PostComment = require('../models/PostComment');
const User = require('../models/User');


exports.createComment = async (req, res) => {
  const userId = req.user.id;
  const { postId, commentText } = req.body;

  if (!commentText || !postId) {
    return res.status(400).json({ message: 'postId and commentText are required.' });
  }

  try {
    const comment = await PostComment.create({
      postId,
      userId,
      commentText,
      timestamp: new Date(),
    });

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
  
      await comment.destroy();
  
      return res.status(200).json({ message: 'Comment deleted successfully.' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      return res.status(500).json({ message: 'Failed to delete comment.' });
    }
  };


  exports.getCommentsByPost = async (req, res) => {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const loggedInUserId = req.user.id;
    
    try {
      const comments = await PostComment.findAll({
        where: { postId },
        include: [
          {
            model: User,
            attributes: ['id', 'full_name', 'profile_pic'],
          },
        ],
        order: [['createdAt', 'ASC']],
        limit,
        offset,
      });
  
      const formatted = comments.map(comment => ({
        id: comment.id,
        user: {
          id: comment.User.id,
          name: comment.User.full_name,
          profilePic: comment.User.profile_pic,
        },
        commentText: comment.commentText,
        timestamp: comment.createdAt,
        canDelete: comment.User.id === loggedInUserId
      }));
  
      return res.status(200).json({ comments: formatted });
    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ message: 'Failed to fetch comments.' });
    }
  };