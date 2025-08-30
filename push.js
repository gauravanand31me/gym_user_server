// sendNotification.js
const sequelize = require("./config/db");
const PushNotification = require("./models/PushNotification");
const { sendPushNotification } = require("./config/pushNotification");
const { Op } = require("sequelize"); // ✅ Needed for filtering

async function sendNotification() {
  try {
    // ✅ Extract message from CLI args
    const args = process.argv.slice(2);
    const messageIndex = args.indexOf("--message");
    if (messageIndex === -1 || !args[messageIndex + 1]) {
      console.error("❌ Please provide a message using --message \"Your text here\"");
      process.exit(1);
    }
    const message = args[messageIndex + 1];

    console.log("🔔 Sending push notification to all users with tokens...");
    console.log("Message:", message);

    // 🔄 Modified this block to include ALL tokens (even null ones)
    const pushTokens = await PushNotification.findAll({
      // Removed filter: where: { expoPushToken: { [Op.ne]: null } }
      attributes: ["expoPushToken", "userId"],
    });

    const totalTokens = pushTokens.length;
    console.log(`📦 Found ${totalTokens} push token(s) in the database (including nulls).`);

    if (totalTokens === 0) {
      console.log("⚠️ No push token records found.");
      process.exit(0);
    }

    let sentCount = 0;
    let skippedCount = 0;

    // ✅ Send push notifications
    for (const tokenObj of pushTokens) {
      const token = tokenObj.expoPushToken;
      const userId = tokenObj.userId;

      // ✅ Log all userId/token pairs, even null
      console.log(`👤 userId: ${userId}, token: ${token}`);

      if (token && typeof token === "string" && token.trim() !== "") {
        await sendPushNotification(token, {
          title: "📢 Announcement",
          body: message,
        });
        console.log(`📨 Sent push to userId ${userId}`);
        sentCount++;
      } else {
        console.log(`⏭️ Skipped userId ${userId} due to invalid token`);
        skippedCount++;
      }
    }

    console.log(`✅ Push notifications sent: ${sentCount}`);
    console.log(`🚫 Skipped users (invalid/missing tokens): ${skippedCount}`);
    console.log("🎉 Done.");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error sending push notifications:", error);
    process.exit(1);
  }
}

sendNotification();
