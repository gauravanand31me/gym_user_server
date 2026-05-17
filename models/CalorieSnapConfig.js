const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Singleton table — always one row with id = 1
const CalorieSnapConfig = sequelize.define('CalorieSnapConfig', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: false,
    defaultValue:  1,
  },
  monthlyPrice: {
    type:         DataTypes.INTEGER, // stored in paise (₹129 = 12900)
    allowNull:    false,
    defaultValue: 12900,
  },
  yearlyPrice: {
    type:         DataTypes.INTEGER, // stored in paise (₹1200 = 120000)
    allowNull:    false,
    defaultValue: 120000,
  },
  trialDays: {
    type:         DataTypes.INTEGER,
    allowNull:    false,
    defaultValue: 3,
  },
  dailyLimit: {
    type:         DataTypes.INTEGER, // scans per day during trial
    allowNull:    false,
    defaultValue: 4,
  },
  subscribedDailyLimit: {
    type:         DataTypes.INTEGER, // scans per day for paid subscribers
    allowNull:    false,
    defaultValue: 6,
  },
}, {
  tableName:  'CalorieSnapConfig',
  timestamps: true,
});

module.exports = CalorieSnapConfig;
