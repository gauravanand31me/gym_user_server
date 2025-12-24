'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Messages', 'request', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Messages', 'request');
  }
};