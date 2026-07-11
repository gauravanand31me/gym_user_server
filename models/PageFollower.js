const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PageFollower = sequelize.define('PageFollower', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true,
  },
  page_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
  },
  user_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  joined_at: {
    type:         DataTypes.DATE,
    allowNull:    false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName:  'PageFollowers',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['page_id', 'user_id'] },
  ],
});

module.exports = PageFollower;
