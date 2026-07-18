require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize   = require('../config/db');

const User           = require('../models/User');
const Feed           = require('../models/Feed');
const Follow         = require('../models/Follow');
const PostReaction   = require('../models/PostReaction');
const PostComment    = require('../models/PostComment');
const Message        = require('../models/Message');
const MessageRequest = require('../models/MessageRequest');
const Notification   = require('../models/Notification');
const { pushToUser } = require('../utils/pushHelpers');

// ─── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  maxActionsPerBot:   6,    // max actions a single bot takes per run
  likeChance:         0.72, // probability a bot likes a visible post
  commentChance:      0.30, // probability a bot comments on a post (after liking)
  followChance:       0.80, // probability a bot follows a real user it doesn't follow yet
  dmChance:           0.25, // probability a bot DMs a real user it follows
  reelReactionChance: 0.55, // probability a bot reacts to a video reel post
  recentDays:         21,   // look at posts from this many days back
  delayMin:           400,  // ms — min delay between actions (feels human)
  delayMax:           1800, // ms — max delay between actions
  botsPerRun:         5,    // how many bot accounts activate per run
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const roll  = (chance) => Math.random() < chance;
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

// ─── Comment templates (by feed activityType) ─────────────────────────────────

const COMMENTS = {
  general: [
    'This is exactly what I needed to see today 🔥',
    'The dedication is unreal. Respect 💪',
    "Goals right here 👊 Keep pushing!",
    'Consistency over everything 🏆',
    'Love the energy! Keep it going 🙌',
    'Bro this is motivation 🚀 Following for more',
    'This hits different on a Monday morning 😤',
    'The work ethic is real. Love this 🔥',
    'Hard work is paying off — clearly! 💪',
  ],
  then_now: [
    'WOW. This transformation is incredible 😮💪',
    'The hard work is showing! Look at that difference 🔥',
    "This is what discipline looks like. Respect 🙌",
    "You look amazing! What a journey ❤️",
    'Before → After energy is completely different. Glowing ✨',
    'HOW?? This is insane motivation. What was your program? 🙏',
    'Sending this to myself for when I want to skip the gym 😂',
    'The glow up is real 💫 Absolutely amazing',
  ],
  meal: [
    'This looks incredible 😍 What\'s the recipe?',
    'Clean eating looking elite rn 🥗💚',
    'Honestly making me want to meal prep right now 😂',
    'Protein goals right there 💪 How many grams?',
    'This is making me hungry at 11 PM 😅',
    'Meal prep Sunday energy ✅ Stealing this idea',
    'The macros on this must be perfect 🤌',
    'Indian food + high protein = undefeated combo 🙌',
  ],
  challenge: [
    'You got this! Day by day 💪',
    'Keep the streak alive! 🔥',
    'Following this challenge too! Solidarity ✊',
    'The consistency is everything. Don\'t stop now!',
    'LET\'S GOOO 🚀🔥',
    'Challenge accepted! You\'re inspiring me to start too 💪',
    'This is the accountability I needed to see 🙌',
  ],
  checkin: [
    'Great gym choice! Love that place 🏋️',
    'The grind never stops 💪',
    'Early bird gets the gains 🌅',
    'Spotted in the wild 😄 Keep crushing it!',
    'This gym hits different in the morning 🔥',
    'The check-in life 📍 Never miss a session',
  ],
  milestone: [
    'HUGE!! Congratulations 🏆🔥',
    'This took serious work! You should be so proud 💪',
    'Legend! The effort you put in is showing 🙌',
    'Next milestone loading... 🚀',
    'This is everything! So happy for you 🎉',
    'Bro. BRO. This is incredible 😤💪',
    'From dream to reality. You did it! ✅',
  ],
  aiPromo: [
    '🔥🔥🔥',
    'Saved! Need to watch this again',
    'The edit on this... 🤌 Fire',
    'This reel literally got me off the couch 😂💪',
    'Following for more like this!',
    'Bro sent me 🔥',
    'Need this energy everyday tbh',
  ],
  page_post: [
    'Needed to see this today 🙌',
    'Great content as always! 💪',
    'This page is such a gem 🔥',
    'Sharing this with my gym partner',
    'Facts only 💯',
    'Thank you for posting this ❤️',
  ],
};

const fallbackComments = [
  'Love this! 🔥',
  '💪💪',
  'Incredible! Keep going!',
  'This is so motivating 🙌',
  'Goals! ✅',
];

const getComment = (activityType) =>
  pick(COMMENTS[activityType] || fallbackComments);

// ─── DM templates ─────────────────────────────────────────────────────────────

const WELCOME_DMS = [
  "Hey! Just stumbled on your profile — love what you're doing 💪 Keep it up!",
  "Your fitness journey is honestly so inspiring. What does your current program look like? 🙏",
  "Just followed you! Your posts are exactly the kind of content I need on my feed 🔥",
  "Yo! Saw your recent post and had to reach out. Seriously motivating stuff 🙌",
  "Love your energy on here! How long have you been on your fitness journey? 💪",
  "Hey! New to Yupluck and your content caught my eye 😄 Glad to connect! Let's push each other 🚀",
  "Your consistency is something else. How do you stay so motivated? Asking for real 😅",
  "Just started following you — your transformation story hits different. Inspiring fr 🔥",
];

const REACTION_DMS = [
  "That last post was 🔥 Had to slide in and say something haha",
  "Bro your recent post legit got me to skip Netflix and go for a run 😂 So thanks",
  "Just saw your post and it motivated me to not skip leg day today. You owe me nothing, I owe you everything 😤💪",
  "Hey! Your meal prep post saved my week — finally eating clean again. Thank you 🙏",
];

// ─── Notification helper ───────────────────────────────────────────────────────

async function createNotification({ forUserId, fromUser, type, message, relatedId }) {
  await Notification.create({
    userId:       forUserId,
    forUserId:    fromUser.id,
    type,
    message,
    profileImage: fromUser.profile_pic || 'https://d59q7mzjlaq7y.cloudfront.net/thumbnails/empty.png',
    relatedId:    relatedId || null,
    status:       'unread',
  }).catch(() => {}); // never crash the bot on notification failure
}

// ─── Action: Like a post ───────────────────────────────────────────────────────

async function likePost(bot, post) {
  // Only 'like' is supported by the PostReaction controller
  const [, created] = await PostReaction.findOrCreate({
    where:    { postId: post.id, userId: bot.id },
    defaults: { reactionType: 'like' },
  });

  if (!created) return; // already reacted

  // Bump like count on the feed post
  await Feed.increment('like_count', { by: 1, where: { id: post.id } }).catch(() => {});

  if (post.userId !== bot.id) {
    await createNotification({
      forUserId: post.userId,
      fromUser:  bot,
      type:      'reaction',
      message:   `${bot.full_name} liked your post`,
      relatedId: post.id,
    });

    // Push for likes — only 40% chance so it doesn't feel spammy
    if (Math.random() < 0.4) {
      await pushToUser(
        post.userId,
        `${bot.full_name} liked your post ❤️`,
        (post.title || post.description || '').substring(0, 80) || 'Check it out',
        { type: 'reaction', postId: post.id }
      );
    }
  }

  return true;
}

// ─── Action: Comment on a post ────────────────────────────────────────────────

async function commentOnPost(bot, post) {
  const text = getComment(post.activityType);

  await PostComment.create({
    postId:      post.id,
    userId:      bot.id,
    commentText: text,
    timestamp:   new Date(Date.now() - rand(0, 3600_000)),
  });

  await Feed.increment('comment_count', { by: 1, where: { id: post.id } }).catch(() => {});

  // relatedId must be the FEED POST ID (not comment ID) — matches createComment.js:90
  if (post.userId !== bot.id) {
    await createNotification({
      forUserId: post.userId,
      fromUser:  bot,
      type:      'comment',
      message:   `${bot.full_name} commented on your post`,
      relatedId: post.id,
    });

    // Push notification so user actually sees it on their phone
    await pushToUser(
      post.userId,
      `${bot.full_name} commented on your post 💬`,
      `"${text.substring(0, 80)}"`,
      { type: 'comment', postId: post.id }
    );
  }

  return true;
}

// ─── Action: Follow a real user ────────────────────────────────────────────────

async function followUser(bot, target) {
  const [, created] = await Follow.findOrCreate({
    where:    { followerId: bot.id, followingId: target.id },
    defaults: { followedOn: new Date() },
  });

  if (!created) return;

  await User.increment('followers_count', { by: 1, where: { id: target.id } }).catch(() => {});
  await User.increment('following_count', { by: 1, where: { id: bot.id } }).catch(() => {});

  // The real followUser controller does NOT create a Notification record —
  // no notification for follows, so we skip it too (avoids dead-link notifications).

  return true;
}

// ─── Action: DM a user ────────────────────────────────────────────────────────

async function sendDM(bot, target, text) {
  const chatId = [bot.id, target.id].sort().join('_');

  // Create or update MessageRequest so the message lands in inbox (not requests)
  await MessageRequest.findOrCreate({
    where:    { chat_id: chatId, receiver_id: target.id },
    defaults: { status: 'auto' },
  });

  await Message.create({
    id:           uuidv4(),
    chat_id:      chatId,
    sender_id:    bot.id,
    receiver_id:  target.id,
    message_type: 'text',
    text,
    is_read:      false,
  });

  // The real app does NOT store a Notification row for messages —
  // it delivers them via socket / push notification only.
  // So no Notification.create here — avoids dead-link taps.

  return true;
}

// ─── MAIN BOT RUN ─────────────────────────────────────────────────────────────

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log(`\n🤖 Yupluck Engagement Bot — ${new Date().toLocaleString('en-IN')}`);
    console.log('═'.repeat(60));

    // ── 1. Load bot accounts (seed users by @yupluck.dev email) ──────────────
    const botUsers = await User.findAll({
      where: { email: { [Op.like]: '%@yupluck.dev' } },
      attributes: ['id', 'full_name', 'username', 'profile_pic', 'email'],
    });

    if (!botUsers.length) {
      console.log('⚠️  No bot users found. Run `npm run seed:full` first.');
      process.exit(0);
    }
    console.log(`\n📋 ${botUsers.length} bot accounts loaded`);

    // ── 2. Load real users (not bots, registered any time) ───────────────────
    const realUsers = await User.findAll({
      where: {
        email: { [Op.notLike]: '%@yupluck.dev' },
        is_verified: true,
      },
      attributes: ['id', 'full_name', 'username', 'profile_pic', 'register_date'],
      order: [['register_date', 'DESC']],
      limit: 100,
    });

    console.log(`👥 ${realUsers.length} real user(s) found\n`);

    if (!realUsers.length) {
      console.log('ℹ️  No real users yet — nothing to engage with.');
      process.exit(0);
    }

    // ── 3. Load recent feed posts (from ALL users — bots & real) ─────────────
    const allUserIds = [...botUsers.map(u => u.id), ...realUsers.map(u => u.id)];
    const recentPosts = await Feed.findAll({
      where: {
        userId:       { [Op.in]: allUserIds },
        timestamp:    { [Op.gte]: daysAgo(CONFIG.recentDays) },
        activityType: { [Op.notIn]: ['workoutInvite', 'gymAd'] }, // skip these
      },
      attributes: ['id', 'userId', 'activityType', 'title', 'description'],
      order: [['timestamp', 'DESC']],
      limit: 80,
    });

    console.log(`📰 ${recentPosts.length} recent posts in scope`);

    // ── 4. Pick bots for this run ─────────────────────────────────────────────
    const shuffledBots = [...botUsers].sort(() => 0.5 - Math.random());
    const activeBots   = shuffledBots.slice(0, CONFIG.botsPerRun);

    console.log(`🎯 ${activeBots.length} bots activating this run:\n`);

    let totalActions = 0;

    for (const bot of activeBots) {
      let botActions = 0;
      console.log(`  ▶ @${bot.username}`);

      // ── 4a. Follow real users this bot doesn't follow yet ─────────────────
      if (botActions < CONFIG.maxActionsPerBot) {
        const alreadyFollowing = await Follow.findAll({
          where: { followerId: bot.id, followingId: { [Op.in]: realUsers.map(u => u.id) } },
          attributes: ['followingId'],
        });
        const followingIds = new Set(alreadyFollowing.map(f => f.followingId));
        const unfollowed   = realUsers.filter(u => !followingIds.has(u.id));

        for (const target of unfollowed.slice(0, 3)) {
          if (botActions >= CONFIG.maxActionsPerBot) break;
          if (!roll(CONFIG.followChance)) continue;

          await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
          const done = await followUser(bot, target);
          if (done) {
            console.log(`     ✔ followed @${target.username}`);
            botActions++;
            totalActions++;
          }
        }
      }

      // ── 4b. Like & comment on recent posts ────────────────────────────────
      if (botActions < CONFIG.maxActionsPerBot) {
        // Exclude posts the bot already reacted to
        const reactedTo = await PostReaction.findAll({
          where: { userId: bot.id, postId: { [Op.in]: recentPosts.map(p => p.id) } },
          attributes: ['postId'],
        });
        const reactedIds = new Set(reactedTo.map(r => r.postId));

        // Exclude bot's own posts
        const candidatePosts = recentPosts
          .filter(p => p.userId !== bot.id && !reactedIds.has(p.id))
          .sort(() => 0.5 - Math.random()) // shuffle
          .slice(0, 8);

        for (const post of candidatePosts) {
          if (botActions >= CONFIG.maxActionsPerBot) break;

          const isReel = post.activityType === 'aiPromo';
          const likeProb = isReel ? CONFIG.reelReactionChance : CONFIG.likeChance;

          if (!roll(likeProb)) continue;

          await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
          const liked = await likePost(bot, post);
          if (liked) {
            console.log(`     ✔ liked [${post.activityType}] "${(post.title || post.description || '').substring(0, 40)}"`);
            botActions++;
            totalActions++;
          }

          // Maybe also comment
          if (botActions < CONFIG.maxActionsPerBot && roll(CONFIG.commentChance)) {
            await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
            await commentOnPost(bot, post);
            console.log(`     ✔ commented on [${post.activityType}]`);
            botActions++;
            totalActions++;
          }
        }
      }

      // ── 4c. DM a real user the bot follows ────────────────────────────────
      if (botActions < CONFIG.maxActionsPerBot && roll(CONFIG.dmChance)) {
        const following = await Follow.findAll({
          where: { followerId: bot.id, followingId: { [Op.in]: realUsers.map(u => u.id) } },
          attributes: ['followingId'],
          limit: 10,
        });

        if (following.length > 0) {
          const targetId = pick(following).followingId;
          const target   = realUsers.find(u => u.id === targetId);

          if (target) {
            // Check we haven't DM'd them recently
            const chatId = [bot.id, target.id].sort().join('_');
            const recent = await Message.findOne({
              where: {
                chat_id:   chatId,
                sender_id: bot.id,
                created_at: { [Op.gte]: daysAgo(3) },
              },
            });

            if (!recent) {
              const isNewUser = target.register_date && target.register_date > daysAgo(7);
              const text = isNewUser
                ? pick(WELCOME_DMS)
                : pick([...WELCOME_DMS, ...REACTION_DMS]);

              await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
              await sendDM(bot, target, text);
              console.log(`     ✔ DM'd @${target.username}`);
              botActions++;
              totalActions++;
            }
          }
        }
      }

      console.log(`     → ${botActions} action(s) taken\n`);
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('═'.repeat(60));
    console.log(`✅ Run complete — ${totalActions} total action(s) across ${activeBots.length} bots`);
    console.log(`   Next run: schedule via cron or run \`npm run bot\` again`);
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Bot error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

run();
