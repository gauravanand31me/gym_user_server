'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('FriendRequests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      fromUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users', // Name of the Users table
          key: 'id'
        },
        onDelete: 'CASCADE' // Optional: define behavior when related user is deleted
      },
      toUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users', // Name of the Users table
          key: 'id'
        },
        onDelete: 'CASCADE' // Optional: define behavior when related user is deleted
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending'
      },
      sentOn: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      acceptedOn: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FriendRequests');
  }
};
