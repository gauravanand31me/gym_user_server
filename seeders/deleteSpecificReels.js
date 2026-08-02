require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/db');

// Feed IDs to delete
const FEED_IDS = [
  '556e2b48-93dc-41e6-9eff-7be3f103dcf6',
  'e5fc0f87-9d5f-4549-b4f4-974c66b6d51d',
  '8cb49356-cab1-409e-9622-ceb951bf6ee6',
  'ce2a894a-6ae2-49f3-a304-15b65f52100d',
  'fa266ed5-1c12-4c76-a190-2454cde2e55f',
];

async function run() {
  await sequelize.authenticate();
  console.log('\n── Diagnosing...\n');

  // 1. Check Feeds
  const feeds = await sequelize.query(
    `SELECT id, "userId", "activityType" FROM "Feeds" WHERE id = ANY($1::uuid[])`,
    { bind: [FEED_IDS], type: sequelize.QueryTypes.SELECT }
  );
  console.log(`Feeds found: ${feeds.length}`);
  feeds.forEach(f => console.log(`  • ${f.id} [${f.activityType}]`));

  // 2. Check Reels by exact id match
  const reelsById = await sequelize.query(
    `SELECT id, "videoUrl" FROM "Reels" WHERE id = ANY($1::uuid[])`,
    { bind: [FEED_IDS], type: sequelize.QueryTypes.SELECT }
  );
  console.log(`\nReels found by id: ${reelsById.length}`);

  // 3. Check Reels by videoUrl containing any of the feed IDs (actual lookup)
  const reelsByUrl = await sequelize.query(
    `SELECT id, "videoUrl" FROM "Reels"
     WHERE ${FEED_IDS.map((_, i) => `"videoUrl" LIKE $${i + 1}`).join(' OR ')}`,
    {
      bind: FEED_IDS.map(id => `%${id}%`),
      type: sequelize.QueryTypes.SELECT,
    }
  );
  console.log(`Reels found by videoUrl: ${reelsByUrl.length}`);
  reelsByUrl.forEach(r => console.log(`  • ${r.id}`));

  // Collect all real Reel IDs (union of both lookups)
  const allReelIds = [...new Set([
    ...reelsById.map(r => r.id),
    ...reelsByUrl.map(r => r.id),
  ])];

  const allPostIds = [...new Set([...FEED_IDS, ...allReelIds])];

  if (!feeds.length && !allReelIds.length) {
    console.log('\nℹ️  Nothing found — already deleted or IDs are wrong.');
    process.exit(0);
  }

  console.log(`\n── Deleting...\n`);

  // PostReactions
  const [, pr] = await sequelize.query(
    `DELETE FROM "PostReactions" WHERE "postId" = ANY($1::uuid[])`,
    { bind: [allPostIds] }
  );
  console.log(`✔ PostReactions: ${pr.rowCount ?? 0} deleted`);

  // PostComments
  const [, pc] = await sequelize.query(
    `DELETE FROM "PostComments" WHERE "postId" = ANY($1::uuid[])`,
    { bind: [allPostIds] }
  );
  console.log(`✔ PostComments:  ${pc.rowCount ?? 0} deleted`);

  // Notifications
  const [, pn] = await sequelize.query(
    `DELETE FROM "Notification" WHERE "relatedId" = ANY($1::uuid[])`,
    { bind: [allPostIds] }
  );
  console.log(`✔ Notifications: ${pn.rowCount ?? 0} deleted`);

  // Reels
  if (allReelIds.length) {
    const [, pr2] = await sequelize.query(
      `DELETE FROM "Reels" WHERE id = ANY($1::uuid[])`,
      { bind: [allReelIds] }
    );
    console.log(`✔ Reels:         ${pr2.rowCount ?? 0} deleted`);
  }

  // Feeds
  if (feeds.length) {
    const [, pf] = await sequelize.query(
      `DELETE FROM "Feeds" WHERE id = ANY($1::uuid[])`,
      { bind: [FEED_IDS] }
    );
    console.log(`✔ Feeds:         ${pf.rowCount ?? 0} deleted`);
  }

  console.log('\n✅ Done.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
