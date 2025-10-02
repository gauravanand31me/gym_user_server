const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  numberOfPosts: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  isChallenge: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'Categories',
  timestamps: false, // Set true if you want Sequelize to manage createdAt/updatedAt
});

Category.associate = (models) => {
  // Future associations (if any)
  // For example: Category.hasMany(models.Workout, { foreignKey: 'categoryId' });
};

module.exports = Category;