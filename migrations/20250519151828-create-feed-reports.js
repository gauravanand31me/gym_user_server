'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('FeedReports', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      feedId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Feeds',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add composite unique constraint to prevent duplicate reports
    await queryInterface.addConstraint('FeedReports', {
      fields: ['userId', 'feedId'],
      type: 'unique',
      name: 'unique_user_feed_report',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FeedReports');
  },
};
