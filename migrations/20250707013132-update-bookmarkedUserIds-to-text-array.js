'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Feeds', 'bookmarkedUserIds', {
      type: Sequelize.ARRAY(Sequelize.UUID),
      allowNull: true,
      defaultValue: [],
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Optional: revert to previous type (if known)
    await queryInterface.changeColumn('Feeds', 'bookmarkedUserIds', {
      type: Sequelize.ARRAY(Sequelize.UUID), // or original type if needed
      allowNull: true,
      defaultValue: [],
    });
  }
};
