const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const FriendRequest = sequelize.define('FriendRequest', {
    fromUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users', // The name of the Users table
            key: 'id'
        }
    },
    toUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users', // The name of the Users table
            key: 'id'
        }
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
    },
    sentOn: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    acceptedOn: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    tableName: 'FriendRequests',
    timestamps: true // Adds createdAt and updatedAt fields
}
);

module.exports = FriendRequest;
