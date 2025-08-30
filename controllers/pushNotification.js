// controllers/notificationController.js
const PushNotification = require("../models/PushNotification");
const { sendPushNotification } = require("../config/pushNotification");

exports.sendPushNotificationToAll = async (req, res) => {
  const { title, message } = req.query;

  if (!message || !title) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameters: 'title' and 'message'",
    });
  }

  try {
    console.log("🔔 Sending push notification via API...");
    console.log("Title:", title);
    console.log("Message:", message);

    // Fetch all records (including those with null tokens)
    const pushTokens = await PushNotification.findAll({
      attributes: ["expoPushToken", "userId"],
    });

    const totalTokens = pushTokens.length;
    console.log(`📦 Found ${totalTokens} record(s) in the database (including nulls).`);

    let sentCount = 0;
    let skippedCount = 0;
    const usersList = [];

    for (const tokenObj of pushTokens) {
      const token = tokenObj.expoPushToken;
      const userId = tokenObj.userId;

      usersList.push({ userId, expoPushToken: token });

      if (token && typeof token === "string" && token.trim() !== "") {
        await sendPushNotification(token, {
          title,
          body: message,
        });
        console.log(`📨 Sent push to userId ${userId}`);
        sentCount++;
      } else {
        console.log(`⏭️ Skipped userId ${userId} due to invalid token`);
        skippedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      title,
      message,
      total: totalTokens,
      sent: sentCount,
      skipped: skippedCount,
      users: usersList,
    });
  } catch (error) {
    console.error("❌ Error sending push notifications:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while sending notifications",
    });
  }
};
