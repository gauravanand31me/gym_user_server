const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require("./User");


const UserImage = sequelize.define('UserImage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users', // Name of the target model
        key: 'id', // Key in the target model that the foreign key refers to
      },
      onDelete: 'CASCADE',
    },
    user_image: {
      type: DataTypes.STRING,
      allowNull: false
    },
    likes_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    
  });

  UserImage.belongsTo(User, {
    foreignKey: 'user_id',
    targetKey: 'id', // References the 'id' in User model
});

  module.exports = UserImage;