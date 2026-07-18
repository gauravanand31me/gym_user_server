const PushNotification   = require('../models/PushNotification');
const { sendPushNotification } = require('../config/pushNotification');

/**
 * Send a push notification to a single user.
 * Silently skips if the user has no token stored.
 */
async function pushToUser(userId, title, body, data = {}) {
  try {
    const row = await PushNotification.findOne({ where: { userId } });
    if (!row?.expoPushToken) return;
    await sendPushNotification(row.expoPushToken, { title, body }, data);
  } catch (err) {
    console.error(`[push] Failed for userId ${userId}:`, err.message);
  }
}

/**
 * Send a push notification to multiple users in parallel.
 * Skips users with no token. Never throws.
 */
async function pushToUsers(userIds, title, body, data = {}) {
  if (!userIds?.length) return;
  const unique = [...new Set(userIds)];
  await Promise.allSettled(unique.map(id => pushToUser(id, title, body, data)));
}

module.exports = { pushToUser, pushToUsers };
