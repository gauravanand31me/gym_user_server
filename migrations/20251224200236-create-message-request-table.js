"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MessageRequests", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal("uuid_generate_v4()"),
        allowNull: false,
      },

      chat_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      receiver_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM("pending", "auto", "declined"),
        allowNull: false,
        defaultValue: "pending",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("MessageRequests");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_MessageRequests_status";`
    );
  },
};
