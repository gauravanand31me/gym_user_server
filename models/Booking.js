const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Booking = sequelize.define('Booking', {
  bookingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users', // The name of the Users table
      key: 'id'
    }
  },
  slotId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Slots', // The name of the Slots table
      key: 'id'
    }
  },
  subscriptionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Subscriptions', // The name of the Subscriptions table
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('daily', 'monthly', 'quarterly', 'halfyearly', 'yearly'),
    allowNull: false
  },
  gymId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Gyms', // The name of the Gyms table
      key: 'id'
    }
  },
  bookingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  paymentId: {
    type: DataTypes.STRING,
    defaultValue: () => Math.random().toString(36).substring(2, 15), // Generates a random string
    allowNull: true
  },
  invoiceId: {
    type: DataTypes.STRING,
    defaultValue: () => Math.random().toString(36).substring(2, 15), // Generates a random string
    allowNull: true
  },
  referredBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users', // The name of the Users table for referrals
      key: 'id'
    }
  },
  isCheckedIn: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // New column to hold the booking ID as a string
  stringBookingId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Optionally ensure each booking ID is unique
  },
  // New column for duration of the booking
  duration: {
    type: DataTypes.INTEGER, // Assuming duration is in minutes, adjust as necessary
    allowNull: false,
  },
  // New column for price of the booking
  price: {
    type: DataTypes.FLOAT, // Adjust the type as needed for your use case
    allowNull: false,
  },
}, {
  tableName: 'Booking',
  timestamps: true, // Adds createdAt and updatedAt fields
  
});

// Associations
User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

Booking.associate = (models) => {
  Booking.belongsTo(models.Gym, { foreignKey: 'gymId' });
};

module.exports = Booking;
