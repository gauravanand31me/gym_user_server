const sequelize        = require('../config/db');
const User             = require('../models/User');
const PushNotification = require('../models/PushNotification');
const { sendPushNotification } = require('../config/pushNotification');

// ── GET /user/api/notifications/push-tokens ───────────────────────────────────
exports.listPushTokens = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT pn."userId", pn."expoPushToken", pn."createdAt",
              u.full_name, u.username, u.mobile_number, u.email
       FROM "PushNotifications" pn
       LEFT JOIN "Users" u ON u.id = pn."userId"
       ORDER BY pn."createdAt" DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const tokens = rows.map(r => ({
      userId:        r.userId,
      full_name:     r.full_name,
      username:      r.username,
      mobile:        r.mobile_number,
      email:         r.email,
      expoPushToken: r.expoPushToken,
      tokenValid:    typeof r.expoPushToken === 'string' && r.expoPushToken.startsWith('ExponentPushToken['),
      savedAt:       r.createdAt,
    }));

    return res.json({ count: tokens.length, tokens });
  } catch (err) {
    console.error('listPushTokens error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ── POST /user/api/notifications/test-push ────────────────────────────────────
// Body: { userId?, mobile?, sendToAll?, title?, body? }
exports.testPush = async (req, res) => {
  const { userId, mobile, sendToAll, title = 'Test Notification', body = 'Push is working! 🔥' } = req.body;

  try {
    let tokenRows = [];

    if (sendToAll) {
      tokenRows = await PushNotification.findAll();
    } else if (userId) {
      const row = await PushNotification.findOne({ where: { userId } });
      if (row) tokenRows = [row];
    } else if (mobile) {
      const user = await User.findOne({ where: { mobile_number: mobile }, attributes: ['id'] });
      if (user) {
        const row = await PushNotification.findOne({ where: { userId: user.id } });
        if (row) tokenRows = [row];
      }
    } else {
      return res.status(400).json({ error: 'Provide userId, mobile, or sendToAll: true' });
    }

    if (!tokenRows.length) {
      return res.status(404).json({
        error: 'No push token found for this user',
        hint: 'Token is saved when the user opens the app while logged in. Make sure the app is installed and the user has logged in at least once.',
      });
    }

    const results = [];
    for (const row of tokenRows) {
      console.log(`[testPush] Firing to token: ${row.expoPushToken}`);
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

    return res.json({ sent: results.length, results });
  } catch (err) {
    console.error('testPush error:', err);
    return res.status(500).json({ error: err.message });
  }
};
