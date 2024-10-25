const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

const PushNotification = sequelize.define('PushNotification', {
    id: {
        type: DataTypes.UUID,
        defaultValue: uuidv4,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users', // Assuming your users table is called 'Users'
            key: 'id',
        },
        onDelete: 'CASCADE', // Optional: if a user is deleted, delete associated notifications
    },
    expoPushToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Ensure that the token is unique
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

module.exports = PushNotification;
