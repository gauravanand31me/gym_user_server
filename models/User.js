const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const FriendRequest = require('./FriendRequest');
const sequelize = require('../config/db');


const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: uuidv4,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    mobile_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        set(value) {
            const salt = bcrypt.genSaltSync(10);
            this.setDataValue('password', bcrypt.hashSync(value, salt));
        },
    },
    full_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    profile_pic: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    upload_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    followers_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    following_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    upload_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 0, // 0 = offline, 1 = online, 2 = in gym
    },
    otp: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    total_work_out_time: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    register_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    last_active: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

User.associate = (models) => {
    User.hasMany(models.Notification, {
      foreignKey: 'userId',
      as: 'notifications', // Alias to use when fetching notifications
    });
};

module.exports = User;
