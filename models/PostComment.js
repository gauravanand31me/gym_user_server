const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');
const Feed = require('./Feed');

const PostComment = sequelize.define('PostComment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Feeds',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  commentText: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  comment_likes_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: true,
  },
  comment_reply_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: true,
  },
  mentions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: true
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'PostComments',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'PostComments',
  timestamps: true,
});

// Associations
PostComment.belongsTo(User, { foreignKey: 'userId' });
PostComment.belongsTo(Feed, { foreignKey: 'postId' });

// Self-reference for replies
PostComment.belongsTo(PostComment, { as: 'parent', foreignKey: 'parentId' });
PostComment.hasMany(PostComment, { as: 'replies', foreignKey: 'parentId' });

module.exports = PostComment;
