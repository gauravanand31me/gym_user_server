'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Feeds_activityType"
      ADD VALUE IF NOT EXISTS 'then_now';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Feeds_activityType"
      ADD VALUE IF NOT EXISTS 'meal';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    console.warn("Manual cleanup is required to remove ENUM values.");
  }
};
