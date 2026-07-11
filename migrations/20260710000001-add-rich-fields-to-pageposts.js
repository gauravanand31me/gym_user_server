'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('PagePosts');

    if (!tableDesc.images) {
      await queryInterface.addColumn('PagePosts', 'images', {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
        defaultValue: [],
      });
    }
    if (!tableDesc.link) {
      await queryInterface.addColumn('PagePosts', 'link', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!tableDesc.hashtags) {
      await queryInterface.addColumn('PagePosts', 'hashtags', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      });
    }
    if (!tableDesc.mentions) {
      await queryInterface.addColumn('PagePosts', 'mentions', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('PagePosts', 'images');
    await queryInterface.removeColumn('PagePosts', 'link');
    await queryInterface.removeColumn('PagePosts', 'hashtags');
    await queryInterface.removeColumn('PagePosts', 'mentions');
  },
};
