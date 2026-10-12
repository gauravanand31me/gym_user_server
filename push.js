// Broadcast an announcement to every user with a push token.
// Usage: node push.js --message "Your text here" [--title "Title"]
require("dotenv").config();
const PushNotification = require("./models/PushNotification");
const { sendPushToTokens } = require("./config/pushNotification");

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

async function sendNotification() {
  try {
    const args = process.argv.slice(2);
    const message = argValue(args, "--message");
    const title = argValue(args, "--title") || "📢 Announcement";
    if (!message) {
      console.error('❌ Please provide a message using --message "Your text here"');
      process.exit(1);
    }

    const rows = await PushNotification.findAll({ attributes: ["expoPushToken"] });
    console.log(`📦 Found ${rows.length} push token(s). Sending "${title}": ${message}`);

    const result = await sendPushToTokens(
      rows.map((r) => r.expoPushToken),
      { title, body: message },
      { type: "announcement" }
    );

    console.log(`✅ Sent: ${result.sent}  ❌ Failed: ${result.failed}  ⏭️ Skipped (invalid): ${result.skipped}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error sending push notifications:", error);
    process.exit(1);
  }
}

sendNotification();
