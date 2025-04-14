'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_Feeds_activityType'
        ) THEN
          RAISE NOTICE 'Enum type does not exist.';
        ELSE
          ALTER TYPE "enum_Feeds_activityType" ADD VALUE IF NOT EXISTS 'general';
        END IF;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Sequelize doesn't support removing ENUM values directly
    // Re-creating the column is the safe way (optional rollback)
  }
};
