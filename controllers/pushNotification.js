// controllers/notificationController.js

const PushNotification = require("../models/PushNotification");
const { sendPushToTokens } = require("../config/pushNotification");

exports.sendPushNotificationToAll = async (req, res) => {
  const { title, message } = req.query;

  // 🔒 Validate query params
  if (!title || !message) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameters: 'title' and 'message'",
    });
  }

  try {
    console.log("🔔 Broadcasting push notification:", title);

    const rows = await PushNotification.findAll({ attributes: ["expoPushToken"] });
    const result = await sendPushToTokens(
      rows.map((r) => r.expoPushToken),
      { title, body: message },
      { type: "announcement" }
    );

    return res.status(200).json({
      success: true,
      title,
      message,
      totalTokens: rows.length,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("❌ Error sending push notifications:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while sending notifications",
    });
  }
};
