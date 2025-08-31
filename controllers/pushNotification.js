// controllers/notificationController.js

const User = require("../models/User");
const PushNotification = require("../models/PushNotification");
const { sendPushNotification } = require("../config/pushNotification");

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
    console.log("🔔 Sending push notification via API...");
    console.log("Title:", title);
    console.log("Message:", message);

    // 🧍‍♂️ Fetch all users
    const users = await User.findAll({
      attributes: ["id", "full_name"], // Add or remove fields as needed
    });

    const totalUsers = users.length;
    console.log(`👥 Found ${totalUsers} user(s) in the database.`);

    let sentCount = 0;
    let skippedCount = 0;
    const usersList = [];

    // 🔁 Iterate over users and get their push tokens
    for (const user of users) {
      const userId = user.id;

      // 🧠 Fetch token for this user from PushNotification table
      const tokenEntry = await PushNotification.findOne({
        where: { userId },
        attributes: ["expoPushToken"],
      });

      const token = tokenEntry?.expoPushToken || null;

      // 📝 Track user and token in response
      usersList.push({
        userId,
        name: user.full_name,
        expoPushToken: token,
      });

      // ✅ Send if token is valid
      if (token && typeof token === "string" && token.trim() !== "") {
        await sendPushNotification(token, {
          title,
          body: message,
        });
        console.log(`📨 Sent push to userId ${userId}`);
        sentCount++;
      } else {
        console.log(`⏭️ Skipped userId ${userId} due to invalid or missing token`);
        skippedCount++;
      }
    }

    // 📦 Send final response
    return res.status(200).json({
      success: true,
      title,
      message,
      totalUsers,
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
