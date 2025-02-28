'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Booking_type" ADD VALUE IF NOT EXISTS 'quarterly';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Booking_type" ADD VALUE IF NOT EXISTS 'halfyearly';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Note: Removing ENUM values is more complex and often not supported directly.
    // You would need to recreate the ENUM type without these values if you wanted to roll this back.
    console.warn('Down migration for ENUM value removal is not supported automatically.');
  }
};
