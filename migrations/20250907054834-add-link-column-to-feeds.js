
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Feeds', 'link', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: "",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Feeds', 'link');
  }
};
