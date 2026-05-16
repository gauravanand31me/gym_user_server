const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UserBodyStats = sequelize.define('UserBodyStats', {
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
  heightCm: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  weightKg: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
}, {
  tableName: 'UserBodyStats',
  timestamps: true,
});

module.exports = UserBodyStats;
