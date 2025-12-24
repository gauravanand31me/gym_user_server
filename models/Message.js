const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    chat_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    receiver_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    message_type: {
      type: DataTypes.ENUM("text", "image", "video", "audio"),
      defaultValue: "text",
    },

    text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    media_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    request: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "Messages",
    underscored: true,
    timestamps: true,
  }
);

Message.associate = (models) => {
  Message.belongsTo(models.User, {
    foreignKey: "sender_id",
    as: "sender",
  });

  Message.belongsTo(models.User, {
    foreignKey: "receiver_id",
    as: "receiver",
  });
};

module.exports = Message;
