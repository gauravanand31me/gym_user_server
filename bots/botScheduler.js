/**
 * botScheduler.js
 *
 * Runs the engagement bot on a schedule without needing an external cron.
 * Start with: npm run bot:watch
 *
 * Alternatively, add to your server.js:
 *   require('./bots/botScheduler');
 * to have it run automatically whenever the server is up.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { execFile } = require('child_process');
const path = require('path');

// How often to fire the bot (milliseconds)
const INTERVAL_MS = {
  '15m': 15  * 60 * 1000,
  '30m': 30  * 60 * 1000,
  '1h':  60  * 60 * 1000,
  '2h':  120 * 60 * 1000,
  '4h':  240 * 60 * 1000,
};

const intervalKey = process.env.BOT_INTERVAL || '1h';
const intervalMs  = INTERVAL_MS[intervalKey] || INTERVAL_MS['1h'];

const botScript = path.join(__dirname, 'engagementBot.js');

function runBot() {
  const start = Date.now();
  console.log(`[BotScheduler] ${new Date().toLocaleString('en-IN')} — firing engagement bot`);

  execFile('node', [botScript], { timeout: 60_000 }, (err, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (err)    console.error(`[BotScheduler] Bot error:`, err.message);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[BotScheduler] Run finished in ${elapsed}s. Next run in ${intervalKey}.\n`);
  });
}

console.log(`\n🕐 Bot scheduler started — running every ${intervalKey}`);
console.log(`   Set BOT_INTERVAL env var to change: 15m | 30m | 1h | 2h | 4h\n`);

// Fire once immediately on start, then on interval
runBot();
setInterval(runBot, intervalMs);
