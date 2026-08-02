require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/db');

const IDS = [
  '556e2b48-93dc-41e6-9eff-7be3f103dcf6',
  'e5fc0f87-9d5f-4549-b4f4-974c66b6d51d',
  '8cb49356-cab1-409e-9622-ceb951bf6ee6',
  'ce2a894a-6ae2-49f3-a304-15b65f52100d',
  'fa266ed5-1c12-4c76-a190-2454cde2e55f',
];

async function run() {
  await sequelize.authenticate();
  console.log(`\nDeleting ${IDS.length} feed/reel entries...\n`);

  const steps = [
    { table: 'PostReactions', col: 'postId' },
    { table: 'PostComments',  col: 'postId' },
    { table: 'Notifications', col: 'relatedId' },
    { table: 'Reels',         col: 'id' },
    { table: 'Feeds',         col: 'id' },
  ];

  for (const { table, col } of steps) {
    const [, meta] = await sequelize.query(
      `DELETE FROM "${table}" WHERE "${col}" = ANY($1::uuid[])`,
      { bind: [IDS] }
    );
    console.log(`✔ ${table}: ${meta.rowCount ?? 0} row(s) deleted`);
  }

  console.log('\n✅ Done.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
