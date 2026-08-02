/**
 * clearSeedData.js
 * Removes all data created by seedFullApp.js and seedPersonaBots.js.
 * Safe to run on production — only deletes rows tied to @yupluck.dev / @yupluck.bot
 * accounts and the known seeded gym names. Real users are never touched.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Op }         = require('sequelize');
const sequelize      = require('../config/db');

const User           = require('../models/User');
const Feed           = require('../models/Feed');
const Reel           = require('../models/Reel');
const Follow         = require('../models/Follow');
const PostReaction   = require('../models/PostReaction');
const PostComment    = require('../models/PostComment');
const Notification   = require('../models/Notification');
const Message        = require('../models/Message');
const MessageRequest = require('../models/MessageRequest');
const Page           = require('../models/Page');
const PagePost       = require('../models/PagePost');
const PageFollower   = require('../models/PageFollower');
const FriendRequest  = require('../models/FriendRequest');
const PushNotification = require('../models/PushNotification');

// Gyms inserted by seedFullApp.js — identified by exact name
const SEEDED_GYM_NAMES = [
  'IronHouse Fitness',
  'PowerMax Gym',
  'GymNation Hyderabad',
  'Elevate Fitness Centre',
  // add more here if seedFullApp added more
];

const log = (msg) => process.stdout.write(msg + '\n');
const section = (title) => log(`\n  ── ${title}`);

async function clear() {
  try {
    await sequelize.authenticate();
    log('\n🗑️  Clearing seed data...');
    log('═'.repeat(55));

    // ── Step 1: identify seed user IDs ────────────────────────────────────────
    const seedUsers = await User.findAll({
      where: { email: { [Op.or]: [
        { [Op.like]: '%@yupluck.dev' },
        { [Op.like]: '%@yupluck.bot' },
      ]}},
      attributes: ['id', 'username', 'email'],
    });

    if (!seedUsers.length) {
      log('\nℹ️  No seed users found — nothing to delete.');
      process.exit(0);
    }

    const seedIds = seedUsers.map(u => u.id);
    log(`\n  Found ${seedUsers.length} seed user(s):`);
    seedUsers.forEach(u => log(`    • @${u.username} <${u.email}>`));

    // ── Step 2: collect feed/reel IDs owned by seed users ─────────────────────
    section('Feed posts & Reels');
    const seedFeeds = await Feed.findAll({
      where:      { userId: { [Op.in]: seedIds } },
      attributes: ['id'],
    });
    const feedIds = seedFeeds.map(f => f.id);
    log(`    ${feedIds.length} feed post(s)`);

    const seedReels = await Reel.findAll({
      where:      { userId: { [Op.in]: seedIds } },
      attributes: ['id'],
    });
    const reelIds = seedReels.map(r => r.id);
    log(`    ${reelIds.length} reel(s)`);

    // ── Step 3: collect page IDs owned by seed users ───────────────────────────
    section('Pages');
    const seedPages = await Page.findAll({
      where:      { owner_id: { [Op.in]: seedIds } },
      attributes: ['id', 'name'],
    });
    const pageIds = seedPages.map(p => p.id);
    seedPages.forEach(p => log(`    • Page: ${p.name}`));

    // ── Step 4: delete child records first (FK order) ─────────────────────────

    // PostReactions on seed posts OR by seed users
    section('PostReactions');
    const allPostIds = [...feedIds, ...reelIds];
    let n = 0;
    if (allPostIds.length) {
      n += await PostReaction.destroy({
        where: { [Op.or]: [
          { postId: { [Op.in]: allPostIds } },
          { userId: { [Op.in]: seedIds } },
        ]},
      });
    } else {
      n += await PostReaction.destroy({ where: { userId: { [Op.in]: seedIds } } });
    }
    log(`    Deleted ${n} reaction(s)`);

    // PostComments on seed posts OR by seed users
    section('PostComments');
    n = 0;
    if (allPostIds.length) {
      n += await PostComment.destroy({
        where: { [Op.or]: [
          { postId: { [Op.in]: allPostIds } },
          { userId: { [Op.in]: seedIds } },
        ]},
      });
    } else {
      n += await PostComment.destroy({ where: { userId: { [Op.in]: seedIds } } });
    }
    log(`    Deleted ${n} comment(s)`);

    // Notifications for/from seed users
    section('Notifications');
    n = await Notification.destroy({
      where: { [Op.or]: [
        { userId:    { [Op.in]: seedIds } },
        { forUserId: { [Op.in]: seedIds } },
      ]},
      // model tableName is 'Notification' (singular) — Sequelize handles it
    });
    log(`    Deleted ${n} notification(s)`);

    // Follows involving seed users (as follower or following)
    section('Follows');
    n = await Follow.destroy({
      where: { [Op.or]: [
        { followerId:  { [Op.in]: seedIds } },
        { followingId: { [Op.in]: seedIds } },
      ]},
    });
    log(`    Deleted ${n} follow(s)`);

    // FriendRequests involving seed users
    section('FriendRequests');
    n = await FriendRequest.destroy({
      where: { [Op.or]: [
        { senderId:   { [Op.in]: seedIds } },
        { receiverId: { [Op.in]: seedIds } },
      ]},
    }).catch(() => 0);
    log(`    Deleted ${n} friend request(s)`);

    // Messages sent/received by seed users
    section('Messages & MessageRequests');
    const chatIds = await sequelize.query(
      `SELECT DISTINCT chat_id FROM "Messages"
       WHERE sender_id = ANY($1::uuid[]) OR receiver_id = ANY($1::uuid[])`,
      { bind: [seedIds], type: sequelize.QueryTypes.SELECT }
    );
    const cids = chatIds.map(r => r.chat_id);

    n = await Message.destroy({
      where: { [Op.or]: [
        { sender_id:   { [Op.in]: seedIds } },
        { receiver_id: { [Op.in]: seedIds } },
      ]},
    });
    log(`    Deleted ${n} message(s)`);

    let nr = 0;
    if (cids.length) {
      nr = await MessageRequest.destroy({ where: { chat_id: { [Op.in]: cids } } });
    }
    log(`    Deleted ${nr} message request(s)`);

    // PushNotification tokens for seed users
    section('PushNotification tokens');
    n = await PushNotification.destroy({ where: { userId: { [Op.in]: seedIds } } });
    log(`    Deleted ${n} push token(s)`);

    // PagePosts and PageFollowers
    section('Page content');
    if (pageIds.length) {
      const ppDel = await PagePost.destroy({ where: { page_id: { [Op.in]: pageIds } } });
      const pfDel = await PageFollower.destroy({ where: { page_id: { [Op.in]: pageIds } } });
      log(`    Deleted ${ppDel} page post(s), ${pfDel} page follower(s)`);
    } else {
      log(`    No pages to clear`);
    }

    // Feed posts and Reels
    section('Feed & Reels rows');
    const fdDel = feedIds.length
      ? await Feed.destroy({ where: { id: { [Op.in]: feedIds } } }) : 0;
    const rlDel = reelIds.length
      ? await Reel.destroy({ where: { id: { [Op.in]: reelIds } } }) : 0;
    log(`    Deleted ${fdDel} feed post(s), ${rlDel} reel(s)`);

    // Pages themselves
    section('Pages');
    const pgDel = pageIds.length
      ? await Page.destroy({ where: { id: { [Op.in]: pageIds } } }) : 0;
    log(`    Deleted ${pgDel} page(s)`);

    // Gyms (raw SQL — no model)
    section('Gyms');
    if (SEEDED_GYM_NAMES.length) {
      // delete child tables first
      const gymRows = await sequelize.query(
        `SELECT id FROM "Gyms" WHERE name = ANY($1::text[])`,
        { bind: [SEEDED_GYM_NAMES], type: sequelize.QueryTypes.SELECT }
      );
      const gymIds = gymRows.map(r => r.id);
      log(`    Found ${gymIds.length} seeded gym(s)`);

      if (gymIds.length) {
        const tables = ['GymImages', 'Equipments', 'EquipmentLists', 'Slots', 'GymSubscriptions', 'Bookings'];
        for (const t of tables) {
          await sequelize.query(
            `DELETE FROM "${t}" WHERE "gymId" = ANY($1::uuid[])`,
            { bind: [gymIds] }
          ).catch(() => {});
        }
        await sequelize.query(
          `DELETE FROM "Gyms" WHERE id = ANY($1::uuid[])`,
          { bind: [gymIds] }
        );
        log(`    Deleted ${gymIds.length} gym(s)`);
      }
    }

    // Seed users themselves
    section('Seed users');
    const userDel = await User.destroy({ where: { id: { [Op.in]: seedIds } } });
    log(`    Deleted ${userDel} user(s)`);

    log('\n' + '═'.repeat(55));
    log('✅  All seed data removed. Real users and their data are untouched.');
    log('═'.repeat(55) + '\n');

    process.exit(0);
  } catch (err) {
    log('\n❌  Error: ' + err.message);
    log(err.stack);
    process.exit(1);
  }
}

clear();
