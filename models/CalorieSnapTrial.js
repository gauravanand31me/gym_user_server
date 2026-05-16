const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CalorieSnapTrial = sequelize.define('CalorieSnapTrial', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  firstUseDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Array of { date: "YYYY-MM-DD", count: Number }
  usageLog: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
}, {
  tableName: 'CalorieSnapTrials',
  timestamps: true,
});

module.exports = CalorieSnapTrial;
