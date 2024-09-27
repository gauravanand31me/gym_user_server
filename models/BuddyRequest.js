const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');
const Booking = require('./Booking'); // Assuming you have a Booking model

const BuddyRequest = sequelize.define('BuddyRequest', {
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
    bookingId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Booking', // The name of the Bookings table
            key: 'bookingId'
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
    tableName: 'BuddyRequests',
    timestamps: true // Adds createdAt and updatedAt fields
});

// Establish relationships if necessary
BuddyRequest.belongsTo(User, { as: 'fromUser', foreignKey: 'fromUserId' });
BuddyRequest.belongsTo(User, { as: 'toUser', foreignKey: 'toUserId' });
BuddyRequest.belongsTo(Booking, { foreignKey: 'bookingId' });

module.exports = BuddyRequest;
