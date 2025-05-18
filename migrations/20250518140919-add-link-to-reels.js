'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Reels', 'link', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Optional external link for the reel',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Reels', 'link');
  },
};
