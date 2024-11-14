// models/Notification.js
const { v4: uuidv4 } = require('uuid');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');


  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Automatically generates a UUID when creating a new notification
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'unread',
      allowNull: false,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    relatedId: {
      type: DataTypes.UUID,
      allowNull: true, // Can be null, for related entities like FriendRequest, Post, etc.
    },
    forUserId: {
      type: DataTypes.UUID,
      allowNull: true, // Can be null, for related entities like FriendRequest, Post, etc.
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'Notification',
    timestamps: true // Adds createdAt and updatedAt fields
});

    User.hasMany(Notification, { foreignKey: 'userId' });
  Notification.associate = function (models) {
    Notification.belongsTo(models.User, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
  };

  module.exports = Notification;
 
