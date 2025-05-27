'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PostComments', 'comment_likes_count', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('PostComments', 'comment_reply_count', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('PostComments', 'parentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'PostComments',
        key: 'id',
      },
      onDelete: 'CASCADE', // if a parent comment is deleted, its replies are also removed
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('PostComments', 'comment_likes_count');
    await queryInterface.removeColumn('PostComments', 'comment_reply_count');
    await queryInterface.removeColumn('PostComments', 'parentId');
  }
};
