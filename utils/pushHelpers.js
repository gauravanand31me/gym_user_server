const { Op } = require('sequelize');
const sequelize          = require('../config/db');
const PushNotification   = require('../models/PushNotification');
const { sendPushToTokens, isValidExpoToken } = require('../config/pushNotification');

/**
 * Store a device's Expo token for a user.
 * - Ignores missing/placeholder tokens instead of saving "NA".
 * - A device token belongs to exactly one user: if another account logged in
 *   on this device before, its row is removed so pushes don't go to the wrong
 *   person (and the unique constraint on expoPushToken doesn't blow up).
 * Returns true when a token was saved.
 */
async function savePushToken(userId, expoPushToken) {
  if (!userId || !isValidExpoToken(expoPushToken)) return false;

  await sequelize.transaction(async (transaction) => {
    await PushNotification.destroy({
      where: { [Op.or]: [{ userId }, { expoPushToken }] },
      transaction,
    });
    await PushNotification.create({ userId, expoPushToken }, { transaction });
  });
  return true;
}

/**
 * Send a push notification to a single user.
 * Silently skips if the user has no token stored. Never throws.
 */
async function pushToUser(userId, title, body, data = {}) {
  if (!userId) return;
  return pushToUsers([userId], title, body, data);
}

/**
 * Send the same push notification to multiple users (batched).
 * Skips users with no token. Never throws.
 */
async function pushToUsers(userIds, title, body, data = {}) {
  if (!userIds?.length) return;
  try {
    const rows = await PushNotification.findAll({
      where: { userId: { [Op.in]: [...new Set(userIds)] } },
      attributes: ['expoPushToken'],
    });
    if (!rows.length) return;
    return await sendPushToTokens(rows.map(r => r.expoPushToken), { title, body }, data);
  } catch (err) {
    console.error(`[push] Failed for users ${userIds.join(',')}:`, err.message);
  }
}

module.exports = { savePushToken, pushToUser, pushToUsers };
