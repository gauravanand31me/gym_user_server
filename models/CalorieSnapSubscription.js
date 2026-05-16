const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CalorieSnapSubscription = sequelize.define('CalorieSnapSubscription', {
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
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  plan: {
    type: DataTypes.ENUM('monthly', 'yearly'),
    allowNull: false,
  },
  // "pending" until payment verified, then "active", then "expired"
  status: {
    type: DataTypes.ENUM('pending', 'active', 'expired'),
    allowNull: false,
    defaultValue: 'pending',
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  amount: {
    type: DataTypes.INTEGER, // in paise
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'CalorieSnapSubscriptions',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['orderId'] },
  ],
});

module.exports = CalorieSnapSubscription;
