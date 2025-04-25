'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add the column with default value
    await queryInterface.addColumn('Feeds', 'postType', {
      type: Sequelize.ENUM('public', 'private', 'onlyme'),
      allowNull: false,
      defaultValue: 'public'
    });

    // Step 2: Explicitly update all existing records (for safety)
    await queryInterface.sequelize.query(`
      UPDATE "Feeds" SET "postType" = 'public' WHERE "postType" IS NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Feeds', 'postType');

    // Optional cleanup of ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Feeds_postType";');
  }
};
