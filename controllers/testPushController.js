const { Op } = require('sequelize');
const User             = require('../models/User');
const PushNotification = require('../models/PushNotification');
const { sendPushNotification } = require('../config/pushNotification');

// ── Admin-secret guard (reusable inline) ──────────────────────────────────────
function checkAdmin(req, res) {
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized — provide x-admin-secret header' });
    return false;
  }
  return true;
}

// ── GET /user/api/notifications/push-tokens ───────────────────────────────────
// Lists every stored Expo push token so you can see what's in the DB.
exports.listPushTokens = async (req, res) => {
  if (!checkAdmin(req, res)) return;

  try {
    const rows = await PushNotification.findAll({
      include: [{
        model: User,
        attributes: ['id', 'full_name', 'username', 'mobile_number', 'email'],
      }],
      order: [['createdAt', 'DESC']],
    });

    const tokens = rows.map(r => ({
      userId:        r.userId,
      full_name:     r.User?.full_name,
      username:      r.User?.username,
      mobile:        r.User?.mobile_number,
      expoPushToken: r.expoPushToken,
      tokenValid:    typeof r.expoPushToken === 'string' && r.expoPushToken.startsWith('ExponentPushToken['),
      savedAt:       r.createdAt,
    }));

    return res.json({
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    console.error('listPushTokens error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ── POST /user/api/notifications/test-push ────────────────────────────────────
// Body (JSON):
//   { userId?, mobile?, sendToAll?, title, body }
//
// Examples:
//   Send to one user by mobile:  { "mobile": "9999999999", "title": "Hey", "body": "Test 🔥" }
//   Send to one user by userId:  { "userId": "uuid", "title": "Hey", "body": "Test 🔥" }
//   Broadcast to all:            { "sendToAll": true, "title": "Hey", "body": "Test 🔥" }
exports.testPush = async (req, res) => {
  if (!checkAdmin(req, res)) return;

  const { userId, mobile, sendToAll, title = 'Test Notification', body = 'Push is working! 🔥' } = req.body;

  try {
    let tokenRows = [];

    if (sendToAll) {
      tokenRows = await PushNotification.findAll();
    } else if (userId) {
      const row = await PushNotification.findOne({ where: { userId } });
      if (row) tokenRows = [row];
    } else if (mobile) {
      const user = await User.findOne({
        where: { mobile_number: mobile },
        attributes: ['id'],
      });
      if (user) {
        const row = await PushNotification.findOne({ where: { userId: user.id } });
        if (row) tokenRows = [row];
      }
    } else {
      return res.status(400).json({ error: 'Provide userId, mobile, or sendToAll: true' });
    }

    if (!tokenRows.length) {
      return res.status(404).json({
        error: 'No push token found for the given user',
        hint: 'Token is stored when the user opens the app. Make sure the app is installed and logged in.',
      });
    }

    const results = [];

    for (const row of tokenRows) {
      console.log(`[testPush] Sending to token: ${row.expoPushToken}`);
      const expoResponse = await sendPushNotification(
        row.expoPushToken,
        { title, body },
        { source: 'test-push-api' },
      );
      results.push({
        userId:        row.userId,
        expoPushToken: row.expoPushToken,
        tokenValid:    typeof row.expoPushToken === 'string' && row.expoPushToken.startsWith('ExponentPushToken['),
        expoResponse,
      });
    }

    return res.json({
      sent: results.length,
      results,
    });
  } catch (err) {
    console.error('testPush error:', err);
    return res.status(500).json({ error: err.message });
  }
};
