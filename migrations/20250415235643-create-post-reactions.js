'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PostReactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      postId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      reactionType: {
        type: Sequelize.ENUM('like', 'love', 'haha', 'wow', 'angry'),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Optional: Unique constraint to ensure one reaction per user per post
    await queryInterface.addConstraint('PostReactions', {
      fields: ['userId', 'postId'],
      type: 'unique',
      name: 'unique_user_post_reaction',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PostReactions');
  }
};
