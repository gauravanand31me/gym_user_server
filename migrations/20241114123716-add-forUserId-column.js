'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Notifications', 'forUserId', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: Sequelize.UUIDV4, // Generates a UUID by default
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Notifications', 'forUserId');
  }
};