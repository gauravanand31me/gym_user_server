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
    type: DataTypes.ENUM('daily', 'monthly', 'yearly'),
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
  }
}, {
  tableName: 'Booking',
  timestamps: true // Adds createdAt and updatedAt fields
});




User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

Booking.associate = (models) => {
  Booking.belongsTo(models.Gym, { foreignKey: 'gymId' });
};

module.exports = Booking;