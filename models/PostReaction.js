const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PostReaction = sequelize.define('PostReaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  reactionType: {
    type: DataTypes.ENUM('like', 'love', 'haha', 'wow', 'angry'),
    allowNull: false,
  }
}, {
  tableName: 'PostReactions',
  timestamps: true,
});

module.exports = PostReaction;
