const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require("./User");


const UserAddress = sequelize.define('UserAddress', {
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
    lat: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    long: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    address_line_1: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address_line_2: {
      type: DataTypes.STRING,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false
    },
    pincode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    is_selected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  UserAddress.belongsTo(User, {
    foreignKey: 'user_id',
    targetKey: 'id', // References the 'id' in User model
});

  module.exports = UserAddress;