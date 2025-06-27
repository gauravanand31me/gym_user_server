'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Feeds_activityType" ADD VALUE 'challenge';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Unfortunately, PostgreSQL does not support removing values from ENUM directly.
    // So this part is typically left empty or documented.
    // You'd need to recreate the enum type without the value to truly "remove" it.
  }
};