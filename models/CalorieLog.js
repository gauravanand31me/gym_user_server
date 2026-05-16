const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CalorieLog = sequelize.define('CalorieLog', {
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
  mealLabel: {
    type: DataTypes.ENUM('Breakfast', 'Lunch', 'Dinner', 'Snack'),
    allowNull: false,
  },
  imageUri: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  loggedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  // Array of { name, quantity, calories, protein, carbs, fat }
  items: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  // { calories: Number, protein: String, carbs: String, fat: String }
  total: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  // YYYY-MM-DD — indexed for fast daily queries
  date: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
}, {
  tableName: 'CalorieLogs',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'date'] },
  ],
});

module.exports = CalorieLog;
