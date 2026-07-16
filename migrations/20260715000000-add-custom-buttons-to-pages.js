'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('Pages');
    if (!tableDesc.custom_buttons) {
      await queryInterface.addColumn('Pages', 'custom_buttons', {
        type:         Sequelize.JSON,
        allowNull:    true,
        defaultValue: [],
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Pages', 'custom_buttons');
  },
};
