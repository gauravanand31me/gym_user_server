const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PagePost = sequelize.define('PagePost', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true,
  },
  page_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
  },
  author_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  content: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  image_url: {
    type:      DataTypes.STRING(500),
    allowNull: true,
  },
  images: {
    type:         DataTypes.ARRAY(DataTypes.TEXT),
    allowNull:    true,
    defaultValue: [],
  },
  link: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  hashtags: {
    type:         DataTypes.ARRAY(DataTypes.STRING),
    allowNull:    true,
    defaultValue: [],
  },
  mentions: {
    type:         DataTypes.JSONB,
    allowNull:    true,
    defaultValue: [],
  },
  like_count: {
    type:         DataTypes.INTEGER,
    allowNull:    false,
    defaultValue: 0,
  },
  comment_count: {
    type:         DataTypes.INTEGER,
    allowNull:    false,
    defaultValue: 0,
  },
}, {
  tableName:  'PagePosts',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
});

module.exports = PagePost;
