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
}, {
  tableName: 'PostComments',
  timestamps: true,
});

PostComment.belongsTo(User, { foreignKey: 'userId' });
PostComment.belongsTo(Feed, { foreignKey: 'postId' });

module.exports = PostComment;
