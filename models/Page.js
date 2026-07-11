const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Page = sequelize.define('Page', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true,
  },
  name: {
    type:      DataTypes.STRING(80),
    allowNull: false,
  },
  slug: {
    type:      DataTypes.STRING(90),
    allowNull: false,
    unique:    true,
  },
  category: {
    type:      DataTypes.STRING(30),
    allowNull: false,
  },
  description: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  website: {
    type:      DataTypes.STRING(255),
    allowNull: true,
  },
  profile_image: {
    type:      DataTypes.STRING(500),
    allowNull: true,
  },
  cover_image: {
    type:      DataTypes.STRING(500),
    allowNull: true,
  },
  owner_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  follower_count: {
    type:         DataTypes.INTEGER,
    allowNull:    false,
    defaultValue: 0,
  },
  post_count: {
    type:         DataTypes.INTEGER,
    allowNull:    false,
    defaultValue: 0,
  },
}, {
  tableName:  'Pages',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = Page;
