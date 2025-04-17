const PostReaction = require('../models/PostReaction');

exports.reactToPost = async (req, res) => {
  const { postId, reactionType } = req.body;
  const userId = req.user.id;
  console.log("Request Body", req.body);
  try {
    const existingReaction = await PostReaction.findOne({ where: { postId, userId } });

    if (!existingReaction) {
      // No reaction exists → create one
      const newReaction = await PostReaction.create({ postId, userId, reactionType });
      return res.status(201).json({ message: 'Reaction added', reaction: newReaction });
    }

    if (existingReaction.reactionType === reactionType) {
      // Same reaction exists → remove it
      await existingReaction.destroy();
      return res.status(200).json({ message: 'Reaction removed' });
    }

    // Different reaction → update it
    existingReaction.reactionType = reactionType;
    await existingReaction.save();
    return res.status(200).json({ message: 'Reaction updated', reaction: existingReaction });

  } catch (error) {
    console.error('Error reacting to post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
