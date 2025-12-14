'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'email', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'height', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'weight', {
        type: Sequelize.STRING,
        allowNull: true
    });
    await queryInterface.addColumn('Users', 'muscle_mass', {
        type: Sequelize.STRING,
        allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'email');
    await queryInterface.removeColumn('Users', 'height');
    await queryInterface.removeColumn('Users', 'weight');
    await queryInterface.removeColumn('Users', 'muscle_mass');
  }
};