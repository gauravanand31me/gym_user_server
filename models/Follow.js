const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
  },
  followerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  followingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  followedOn: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'Follows',
  timestamps: true, // includes createdAt and updatedAt
  indexes: [
    {
      unique: true,
      fields: ['followerId', 'followingId'], // Prevent duplicate follows
    },
  ],
});

module.exports = Follow;
