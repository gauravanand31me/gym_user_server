const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Booking = require('./Booking'); // Assuming you have a Booking model
const User = require('./User'); // Assuming you have a Booking model

const Payment = sequelize.define('Payment', {
  paymentId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Booking', // The name of the Booking table
      key: 'bookingId',
    },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users', // The name of the Users table
      key: 'id',
    },
  },
  amount: {
    type: DataTypes.FLOAT, // Adjust the type as needed for your use case
    allowNull: false,
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  paymentMethod: {
    type: DataTypes.ENUM('credit_card', 'debit_card', 'paypal', 'bank_transfer'),
    allowNull: false,
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // Ensures that each transaction ID is unique
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1, // Minimum rating
      max: 5, // Maximum rating
    },
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Optional field for adding notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'Payment',
  timestamps: true, // Adds createdAt and updatedAt fields
});

// Associations
Payment.belongsTo(Booking, { foreignKey: 'bookingId' });
Payment.belongsTo(User, { foreignKey: 'userId' });

module.exports = Payment;
