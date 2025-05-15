'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Reels', 'hashtags', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Reels', 'hashtags');
  },
};
