require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/db');

const FILENAME = '4b377ebe-502d-4f5d-ae61-5c7c8c9a4bd0-1776363671756-jmonlr-4b377ebe-502d-4f5d-ae61-5c7c8c9a4bd0.mp4';

async function run() {
  await sequelize.authenticate();

  const reels = await sequelize.query(
    `SELECT id FROM "Reels" WHERE "videoUrl" LIKE $1`,
    { bind: [`%${FILENAME}%`], type: sequelize.QueryTypes.SELECT }
  );
  console.log('Reels matched:', reels.length, reels.map(r => r.id));

  if (reels.length) {
    const ids = reels.map(r => r.id);
    await sequelize.query(`DELETE FROM "Reels" WHERE id = ANY($1::uuid[])`, { bind: [ids] });
    await sequelize.query(`DELETE FROM "Feeds" WHERE id = ANY($1::uuid[])`, { bind: [ids] });
    console.log('Deleted from Reels and Feeds');
  } else {
    console.log('Nothing found');
  }

  process.exit(0);
}

run().catch(err => { console.error(err.message); process.exit(1); });
