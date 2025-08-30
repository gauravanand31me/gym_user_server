// sendNotification.js
const sequelize = require("./config/db");
const PushNotification = require("./models/PushNotification");
const { sendPushNotification } = require("./config/pushNotification");

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

    // ✅ Fetch all registered push tokens
    const pushTokens = await PushNotification.findAll({
      attributes: ["expoPushToken", "userId"],
    });

    if (pushTokens.length === 0) {
      console.log("⚠️ No push tokens found in the database.");
      process.exit(0);
    }

    // ✅ Send push notifications
    for (const tokenObj of pushTokens) {
      if (tokenObj.expoPushToken) {
        await sendPushNotification(tokenObj.expoPushToken, {
          title: "📢 Announcement",
          body: message,
        });
        console.log(`📨 Sent push to userId ${tokenObj.userId}`);
      }
    }

    console.log(`✅ Push notifications sent to ${pushTokens.length} users.`);
    process.exit(0);

  } catch (error) {
    console.error("❌ Error sending push notifications:", error);
    process.exit(1);
  }
}

sendNotification();
