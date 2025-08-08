'use strict';

const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Feeds', 'randomCode', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Fetch all existing Feed IDs
    const [feeds] = await queryInterface.sequelize.query(`SELECT id FROM "Feeds"`);

    // Assign a random code to each
    for (const feed of feeds) {
      const code = generateRandomCode();
      await queryInterface.sequelize.query(
        `UPDATE "Feeds" SET "randomCode" = :code WHERE id = :id`,
        {
          replacements: { code, id: feed.id },
        }
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Feeds', 'randomCode');
  }
};
