"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Messages", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      chat_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Sorted userId_userId",
      },

      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      receiver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      message_type: {
        type: Sequelize.ENUM("text", "image", "video", "audio"),
        defaultValue: "text",
      },

      text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      media_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      is_read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      is_deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Helpful indexes
    await queryInterface.addIndex("Messages", ["chat_id"]);
    await queryInterface.addIndex("Messages", ["sender_id"]);
    await queryInterface.addIndex("Messages", ["receiver_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Messages");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Messages_message_type";'
    );
  },
};
