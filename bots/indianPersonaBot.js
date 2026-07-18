require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Anthropic    = require('@anthropic-ai/sdk');
const { Op }       = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize    = require('../config/db');

const User           = require('../models/User');
const Feed           = require('../models/Feed');
const Follow         = require('../models/Follow');
const PostReaction   = require('../models/PostReaction');
const PostComment    = require('../models/PostComment');
const Message        = require('../models/Message');
const MessageRequest = require('../models/MessageRequest');
const Notification   = require('../models/Notification');
const { pushToUser } = require('../utils/pushHelpers');

// ─── Persona definitions ───────────────────────────────────────────────────────
// These mirror the users created by seeders/seedPersonaBots.js

const PERSONAS = {
  'arjun.mehta@yupluck.bot': {
    city:        'Mumbai',
    personality: `You are Arjun Mehta, 26, a passionate fitness enthusiast from Mumbai.
You have been hitting the gym for 5+ years — bodybuilding is your life.
You love cricket, biryani, and pushing your limits every day.
Speak in natural Hinglish: mix Hindi and English the way young Indians actually text.
Use casual words: "bhai", "yaar", "ekdum", "mast", "kya baat hai", "arre", "sahi bola".
Tone: friendly, motivational, genuine — like a friend cheering you on.
Keep messages short (1-3 sentences) — no essays, just real talk.
Never sound like a bot or use corporate language.`,
  },
  'kavya.reddy@yupluck.bot': {
    city:        'Hyderabad',
    personality: `You are Kavya Reddy, 24, a yoga and wellness enthusiast from Hyderabad.
You practice yoga every morning and do HIIT 4x a week. You are studying nutrition.
You love South Indian food, calming music, and helping people on their wellness journey.
Speak in Hinglish — the kind Hyderabadi girls actually use on Instagram.
Use words like: "arre yaar", "bilkul sahi", "bahut achha", "ekdum", "na" at end of sentences.
Tone: warm, supportive, genuinely caring — like a wellness big sister.
Keep messages short (1-3 sentences). Sound real and personal, not scripted.`,
  },
};

// ─── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  maxActionsPerBot: 8,
  postChance:       0.30,  // 30% chance bot creates a new feed post each run
  likeChance:       0.75,
  commentChance:    0.50,  // higher — Claude makes natural comments
  followChance:     0.85,
  dmChance:         0.40,
  recentDays:       14,
  delayMin:         900,
  delayMax:         2800,
  dmCooldownDays:   5,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const sleep   = (ms) => new Promise(r => setTimeout(r, ms));
const rand    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const roll    = (p) => Math.random() < p;
const pick    = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

// ─── Anthropic client (lazy init) ─────────────────────────────────────────────

let _anthropic;
function ai() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function ask(system, userMsg, maxTokens = 150) {
  try {
    const res = await ai().messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    return res.content[0]?.text?.trim() || null;
  } catch (err) {
    console.error('[claude] API error:', err.message);
    return null;
  }
}

// ─── Language generation ───────────────────────────────────────────────────────

async function makeComment(persona, post) {
  const context = [post.title, post.description]
    .filter(Boolean).join(' — ').substring(0, 200);
  if (!context) return null;

  return ask(
    persona.personality,
    `Someone posted on a fitness app: "${context}" (post type: ${post.activityType})
Write ONE short comment — max 2 sentences. Use emojis. Make it genuine and specific to their post.
Reply with just the comment text, nothing else.`,
    100
  );
}

async function makeDM(persona, target, latestPost) {
  const postCtx = latestPost
    ? `Their latest post: "${[latestPost.title, latestPost.description].filter(Boolean).join(' — ').substring(0, 150)}"`
    : 'They are a fitness enthusiast on Yupluck.';

  return ask(
    persona.personality,
    `You just followed @${target.username} (${target.full_name}) on Yupluck.
${postCtx}
Send them a first DM. 2-3 sentences max.
Do NOT start with just "Hey" — be specific and genuine.
Reply with just the message text, nothing else.`,
    140
  );
}

const POST_TYPES = ['general', 'meal', 'milestone', 'challenge'];

const POST_PROMPTS = {
  general:   'Write a short motivational post (2-4 sentences) about your workout today or a fitness mindset.',
  meal:      'Write a post about a healthy Indian meal you had. Mention the dish, why it\'s healthy, protein content if relevant.',
  milestone: 'Write a personal fitness milestone post. Could be a PR, a streak, a weight goal, or a body change.',
  challenge: 'Write a 7-day fitness challenge post inviting your followers to join. Make it specific, fun, and achievable.',
};

async function makeFeedPost(persona) {
  const type = pick(POST_TYPES);

  const raw = await ask(
    persona.personality,
    `${POST_PROMPTS[type]}
Return ONLY valid JSON — no markdown, no explanation, no extra text:
{"title":"short title max 10 words","description":"the post text 2-4 sentences + 3-5 hashtags"}`,
    220
  );

  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const p = JSON.parse(m[0]);
    if (!p.title || !p.description) return null;
    return { type, title: p.title, description: p.description };
  } catch {
    return null;
  }
}

// ─── Fallbacks (no API key / API down) ────────────────────────────────────────

const FALLBACK_COMMENTS = {
  general:   ['Bahut badhiya yaar! 🔥 Ekdum mast post hai', 'Kya baat hai! Sach mein inspiring hai yeh 💪', 'Arre wah! Keep it up bhai 🙌'],
  then_now:  ['Arre yaar yeh transformation dekh ke dil khush ho gaya! 😍💪', 'Kya change hai bhai! Mehnat sach mein rang laati hai 🔥', 'Bilkul amazing! Itni dedication kahan se aati hai tumhe? 🙌'],
  meal:      ['Yeh toh ekdum tasty aur healthy dono lag raha hai! 😋 Recipe share karo na?', 'Indian food + fitness = perfect combo 🥗💪 Kya macros hai iska?', 'Yaar yeh dekh ke main bhi healthy khaane ka soch raha/rahi hoon 😂'],
  challenge: ['Yeh challenge try karoonga/karongi zaroor! 💪 Thanks for sharing', 'Day 1 se join kar raha/rahi hoon yaar! 🔥 Let\'s gooo', 'Exactly the motivation I needed today! Challenge accepted 🏋️'],
  checkin:   ['Gym mein dekha toh karein hi kya? Grind never stops 💪', 'Early morning gym energy alag hi hoti hai na! 🌅🔥', 'Spotted! Keep crushing it yaar 🏋️'],
  milestone: ['WAAAH! Yeh toh bahut badi achievement hai yaar! 🏆🔥', 'Seriously proud of you! Itni mehnat ka fal mila 💪', 'Bhai/yaar yeh sunke dil bhar aaya! Amazing progress 🎉'],
  aiPromo:   ['Yeh reel toh 🔥🔥 Save kar liya', 'Ekdum fire content hai yeh 💪', 'Roz aise reels chahiye motivation ke liye honestly'],
  page_post: ['Iss page ki posts ekdum solid hoti hain 🙌', 'Bahut kaam ki information hai yeh! Thanks 🙏', 'Yupluck pe iss page ko follow karna chahiye sab ko 🔥'],
};

const getFallbackComment = (type) =>
  pick(FALLBACK_COMMENTS[type] || FALLBACK_COMMENTS.general);

const FALLBACK_DMS = [
  'Arre yaar, tera profile dekh ke follow karna toh banta tha! 💪 Kab se fitness journey start ki?',
  'Bhai/yaar teri posts bahut mast hoti hain. Seriously motivated ho jaata/jaati hoon main. Kya routine follow karte ho?',
  'Naya naya Yupluck pe aaya/aayi hoon — tera content dekh ke lagaa ki connect zaroor karna chahiye! 🔥',
  'Arre teri fitness journey ekdum inspiring hai. Gym kaab se shuru kiya? 🏋️💪',
];

// ─── Notification helper ───────────────────────────────────────────────────────

async function notify({ forUserId, fromUser, type, message, relatedId }) {
  await Notification.create({
    userId:       forUserId,
    forUserId:    fromUser.id,
    type,
    message,
    profileImage: fromUser.profile_pic || '',
    relatedId:    relatedId || null,
    status:       'unread',
  }).catch(() => {});
}

// ─── Actions ───────────────────────────────────────────────────────────────────

async function likePost(bot, post) {
  const [, created] = await PostReaction.findOrCreate({
    where:    { postId: post.id, userId: bot.id },
    defaults: { reactionType: 'like' },
  });
  if (!created) return false;

  await Feed.increment('like_count', { by: 1, where: { id: post.id } }).catch(() => {});

  if (post.userId !== bot.id) {
    await notify({
      forUserId: post.userId,
      fromUser:  bot,
      type:      'reaction',
      message:   `${bot.full_name} liked your post`,
      relatedId: post.id,
    });
    if (roll(0.35)) {
      await pushToUser(
        post.userId,
        `${bot.full_name} ne aapka post like kiya ❤️`,
        (post.title || post.description || '').substring(0, 80) || 'Check it out',
        { type: 'reaction', postId: post.id }
      );
    }
  }
  return true;
}

async function commentOnPost(bot, post, persona) {
  const useAI = !!process.env.ANTHROPIC_API_KEY;
  const text = useAI
    ? (await makeComment(persona, post) || getFallbackComment(post.activityType))
    : getFallbackComment(post.activityType);

  await PostComment.create({
    postId:      post.id,
    userId:      bot.id,
    commentText: text,
    timestamp:   new Date(Date.now() - rand(0, 3_600_000)),
  });
  await Feed.increment('comment_count', { by: 1, where: { id: post.id } }).catch(() => {});

  if (post.userId !== bot.id) {
    await notify({
      forUserId: post.userId,
      fromUser:  bot,
      type:      'comment',
      message:   `${bot.full_name} commented on your post`,
      relatedId: post.id,
    });
    await pushToUser(
      post.userId,
      `${bot.full_name} ne comment kiya 💬`,
      `"${text.substring(0, 80)}"`,
      { type: 'comment', postId: post.id }
    );
  }
  return true;
}

async function followUser(bot, target) {
  const [, created] = await Follow.findOrCreate({
    where:    { followerId: bot.id, followingId: target.id },
    defaults: { followedOn: new Date() },
  });
  if (!created) return false;

  await User.increment('followers_count', { by: 1, where: { id: target.id } }).catch(() => {});
  await User.increment('following_count', { by: 1, where: { id: bot.id } }).catch(() => {});
  return true;
}

async function sendDM(bot, target, persona) {
  const chatId = [bot.id, target.id].sort().join('_');

  const recent = await Message.findOne({
    where: { chat_id: chatId, sender_id: bot.id, created_at: { [Op.gte]: daysAgo(CONFIG.dmCooldownDays) } },
  });
  if (recent) return false;

  const latestPost = await Feed.findOne({
    where:      { userId: target.id },
    order:      [['timestamp', 'DESC']],
    attributes: ['title', 'description', 'activityType'],
  });

  const useAI = !!process.env.ANTHROPIC_API_KEY;
  const text = useAI
    ? (await makeDM(persona, target, latestPost) || pick(FALLBACK_DMS))
    : pick(FALLBACK_DMS);

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

  await pushToUser(
    target.id,
    `${bot.full_name} ka message aaya ✉️`,
    text.substring(0, 100),
    { type: 'message', senderId: bot.id }
  );

  return true;
}

async function postInFeed(bot, persona) {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  const post = await makeFeedPost(persona);
  if (!post) return false;

  await Feed.create({
    userId:       bot.id,
    activityType: post.type,
    title:        post.title,
    description:  post.description,
    postType:     'public',
    timestamp:    new Date(),
  });

  await User.increment('upload_count', { by: 1, where: { id: bot.id } }).catch(() => {});
  return post;
}

// ─── MAIN RUN ──────────────────────────────────────────────────────────────────

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log(`\n🇮🇳  Yupluck Persona Bot — ${new Date().toLocaleString('en-IN')}`);
    console.log('═'.repeat(60));

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set — will use Hinglish fallback templates instead of AI.');
    } else {
      console.log('🤖 Claude AI enabled — generating natural Hinglish content');
    }

    // Load persona bot users
    const botEmails = Object.keys(PERSONAS);
    const botUsers = await User.findAll({
      where:      { email: { [Op.in]: botEmails } },
      attributes: ['id', 'full_name', 'username', 'profile_pic', 'email'],
    });

    if (!botUsers.length) {
      console.log('\n⚠️  No persona users found. Run: npm run seed:personas');
      process.exit(0);
    }
    console.log(`\n🎭 ${botUsers.length} persona(s) loaded`);

    // Load real users (not any bot domain)
    const realUsers = await User.findAll({
      where: {
        email:       { [Op.notLike]: '%@yupluck.%' },
        is_verified: true,
      },
      attributes: ['id', 'full_name', 'username', 'profile_pic', 'register_date'],
      order:      [['register_date', 'DESC']],
      limit:      100,
    });
    console.log(`👥 ${realUsers.length} real user(s) to engage with`);

    if (!realUsers.length) {
      console.log('ℹ️  No real users yet — nothing to engage with.');
      process.exit(0);
    }

    // Recent posts from real users only (so bots engage real content)
    const recentPosts = await Feed.findAll({
      where: {
        userId:       { [Op.in]: realUsers.map(u => u.id) },
        timestamp:    { [Op.gte]: daysAgo(CONFIG.recentDays) },
        activityType: { [Op.notIn]: ['workoutInvite', 'gymAd'] },
      },
      attributes: ['id', 'userId', 'activityType', 'title', 'description'],
      order:      [['timestamp', 'DESC']],
      limit:      60,
    });
    console.log(`📰 ${recentPosts.length} recent post(s) in scope\n`);

    let totalActions = 0;

    for (const bot of botUsers) {
      const persona = PERSONAS[bot.email];
      if (!persona) continue;

      let botActions = 0;
      console.log(`  ▶ @${bot.username} — ${persona.city}`);

      // ── Post in own feed ──────────────────────────────────────────────────
      if (roll(CONFIG.postChance) && botActions < CONFIG.maxActionsPerBot) {
        await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
        const newPost = await postInFeed(bot, persona);
        if (newPost) {
          console.log(`     ✔ posted [${newPost.type}] "${newPost.title}"`);
          botActions++;
          totalActions++;
        }
      }

      // ── Follow real users ─────────────────────────────────────────────────
      if (botActions < CONFIG.maxActionsPerBot) {
        const alreadyIds = new Set(
          (await Follow.findAll({
            where:      { followerId: bot.id, followingId: { [Op.in]: realUsers.map(u => u.id) } },
            attributes: ['followingId'],
          })).map(f => f.followingId)
        );
        const unfollowed = realUsers.filter(u => !alreadyIds.has(u.id));

        for (const target of unfollowed.slice(0, 3)) {
          if (botActions >= CONFIG.maxActionsPerBot) break;
          if (!roll(CONFIG.followChance)) continue;

          await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
          if (await followUser(bot, target)) {
            console.log(`     ✔ followed @${target.username}`);
            botActions++;
            totalActions++;
          }
        }
      }

      // ── Like & comment on real user posts ─────────────────────────────────
      if (botActions < CONFIG.maxActionsPerBot) {
        const reactedIds = new Set(
          (await PostReaction.findAll({
            where:      { userId: bot.id, postId: { [Op.in]: recentPosts.map(p => p.id) } },
            attributes: ['postId'],
          })).map(r => r.postId)
        );

        const candidates = recentPosts
          .filter(p => p.userId !== bot.id && !reactedIds.has(p.id))
          .sort(() => 0.5 - Math.random())
          .slice(0, 6);

        for (const post of candidates) {
          if (botActions >= CONFIG.maxActionsPerBot) break;
          if (!roll(CONFIG.likeChance)) continue;

          await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
          if (await likePost(bot, post)) {
            console.log(`     ✔ liked [${post.activityType}]`);
            botActions++;
            totalActions++;
          }

          if (botActions < CONFIG.maxActionsPerBot && roll(CONFIG.commentChance)) {
            await sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
            await commentOnPost(bot, post, persona);
            const src = process.env.ANTHROPIC_API_KEY ? 'AI' : 'template';
            console.log(`     ✔ commented [${src}] on [${post.activityType}]`);
            botActions++;
            totalActions++;
          }
        }
      }

      // ── DM a followed real user ────────────────────────────────────────────
      if (botActions < CONFIG.maxActionsPerBot && roll(CONFIG.dmChance)) {
        const following = (await Follow.findAll({
          where:      { followerId: bot.id, followingId: { [Op.in]: realUsers.map(u => u.id) } },
          attributes: ['followingId'],
          order:      sequelize.literal('random()'),
          limit:      15,
        }));

        for (const f of following) {
          if (botActions >= CONFIG.maxActionsPerBot) break;
          const target = realUsers.find(u => u.id === f.followingId);
          if (!target) continue;

          await sleep(rand(1000, 3500));
          if (await sendDM(bot, target, persona)) {
            const src = process.env.ANTHROPIC_API_KEY ? 'AI' : 'template';
            console.log(`     ✔ DM'd @${target.username} [${src}]`);
            botActions++;
            totalActions++;
            break;
          }
        }
      }

      console.log(`     → ${botActions} action(s)\n`);
    }

    console.log('═'.repeat(60));
    console.log(`✅ Run complete — ${totalActions} total action(s)`);
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Persona bot error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

run();
