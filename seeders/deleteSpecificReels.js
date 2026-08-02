require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/db');

async function run() {
  await sequelize.authenticate();

  // Find Islam Khan's user
  const [users] = await sequelize.query(
    `SELECT id, full_name FROM "Users" WHERE full_name ILIKE '%islam%khan%'`
  );
  console.log('Found users:', users);

  if (!users.length) { console.log('User not found'); process.exit(0); }

  const userId = users[0].id;
  console.log('Deleting for userId:', userId);

  await sequelize.query(`DELETE FROM "Reels" WHERE "userId" = $1`, { bind: [userId] });
  console.log('Reels deleted');

  await sequelize.query(`DELETE FROM "Feeds" WHERE "userId" = $1`, { bind: [userId] });
  console.log('Feeds deleted');

  process.exit(0);
}

run().catch(err => { console.error(err.message); process.exit(1); });
