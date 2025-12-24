const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const { v4: uuidv4 } = require('uuid');

const MessageRequest = sequelize.define(
  "MessageRequest",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: uuidv4(),
    },

    chat_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    receiver_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("pending", "auto", "declined"),
      allowNull: false,
      defaultValue: "pending",
    },
  },
  {
    tableName: "MessageRequests",
    underscored: true,
    timestamps: true,
  }
);

MessageRequest.associate = (models) => {
  MessageRequest.belongsTo(models.User, {
    foreignKey: "receiver_id",
    as: "receiver",
  });
};

module.exports = MessageRequest;
