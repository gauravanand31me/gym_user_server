const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Feed = sequelize.define('Feed', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  activityType: {
    type: DataTypes.ENUM('checkin', 'workoutInvite', 'milestone', 'questionPrompt', 'gymAd', 'aiPromo', 'general', 'then_now', 'meal', "challenge"),
    allowNull: false
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  },
  gymId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Gyms',
      key: 'id'
    }
  },
  relatedUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  hours: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  like_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  comment_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  report_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  postType: {
    type: DataTypes.ENUM('public', 'private', 'onlyme'),
    allowNull: false,
    defaultValue: 'public'
  },
  mentionedUserIds: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: true,
    defaultValue: []
  },
  savedUserIds: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: true,
    defaultValue: []
  },
  bookmarkedUserIds: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: true,
    defaultValue: []
  },
  myBookmarks: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    defaultValue: [],
  },
  challengeId: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  randomCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Feeds',
  timestamps: true
});

// Associations
User.hasMany(Feed, { foreignKey: 'userId' });
Feed.belongsTo(User, { foreignKey: 'userId' });

Feed.associate = (models) => {
  Feed.belongsTo(models.Gym, { foreignKey: 'gymId' });
  Feed.belongsTo(models.User, { foreignKey: 'relatedUserId', as: 'relatedUser' });
};

module.exports = Feed;
