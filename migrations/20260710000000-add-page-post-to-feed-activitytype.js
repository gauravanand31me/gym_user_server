'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Feeds_activityType" ADD VALUE IF NOT EXISTS 'page_post';
    `);
  },
  down: async () => {
    // PostgreSQL does not support removing ENUM values
  },
};
