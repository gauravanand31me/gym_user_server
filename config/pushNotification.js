const axios = require("axios");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;   // Expo accepts at most 100 messages per request
const REQUEST_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 3;

const isValidExpoToken = (token) =>
  typeof token === "string" && /^Expo(nent)?PushToken\[.+\]$/.test(token);

const truncate = (text, max) => {
  if (!text) return text;
  const str = String(text).trim();
  return str.length > max ? `${str.slice(0, max - 1).trimEnd()}…` : str;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildMessage(to, message = {}, data = {}) {
  const msg = {
    to,
    sound: "default",
    title: truncate(message.title, 65),
    body: truncate(message.body, 178),
    data: data || {},
    // "high" wakes Android devices in Doze; with "default" FCM may hold the
    // notification until the device wakes up, which looks like a lost push.
    priority: "high",
  };
  if (message.subtitle) msg.subtitle = message.subtitle;
  if (typeof message.badge === "number") msg.badge = message.badge;
  if (message.image) msg.richContent = { image: message.image };
  return msg;
}

async function postToExpo(messages) {
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  for (let attempt = 1; ; attempt++) {
    try {
      const response = await axios.post(EXPO_PUSH_URL, messages, {
        headers,
        timeout: REQUEST_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) throw error;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}

// Expo tells us when a token is dead (app uninstalled, token rotated).
// Remove it so we stop sending into the void.
async function removeDeadTokens(tokens) {
  if (!tokens.length) return;
  try {
    // Required lazily to avoid a require cycle with the models.
    const PushNotification = require("../models/PushNotification");
    await PushNotification.destroy({ where: { expoPushToken: tokens } });
    console.log(`[push] Removed ${tokens.length} unregistered token(s)`);
  } catch (err) {
    console.error("[push] Failed to remove dead tokens:", err.message);
  }
}

/**
 * Send the same notification to many Expo tokens.
 * Invalid tokens are skipped, requests are batched and retried,
 * and tokens Expo reports as DeviceNotRegistered are deleted.
 * Never throws; returns { sent, failed, skipped, tickets }.
 */
async function sendPushToTokens(tokens, message, data = {}) {
  const unique = [...new Set((tokens || []).filter(Boolean))];
  const valid = unique.filter(isValidExpoToken);
  const result = { sent: 0, failed: 0, skipped: unique.length - valid.length, tickets: [] };
  const deadTokens = [];

  for (let i = 0; i < valid.length; i += EXPO_BATCH_SIZE) {
    const chunk = valid.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const response = await postToExpo(chunk.map((to) => buildMessage(to, message, data)));
      const tickets = Array.isArray(response?.data) ? response.data : [];

      tickets.forEach((ticket, idx) => {
        const token = chunk[idx];
        result.tickets.push({ token, ...ticket });
        if (ticket.status === "ok") {
          result.sent++;
        } else {
          result.failed++;
          console.error(`[push] Expo rejected ${token}:`, ticket.message, ticket.details || "");
          if (ticket.details?.error === "DeviceNotRegistered") deadTokens.push(token);
        }
      });
    } catch (error) {
      result.failed += chunk.length;
      console.error(
        "[push] Error sending push notification:",
        error.response ? JSON.stringify(error.response.data) : error.message
      );
    }
  }

  await removeDeadTokens(deadTokens);
  return result;
}

/**
 * Send a notification to a single Expo token.
 * message: { title, body, subtitle?, image?, badge? }
 */
async function sendPushNotification(expoPushToken, message, data = {}) {
  if (!isValidExpoToken(expoPushToken)) {
    if (expoPushToken) console.warn(`[push] Skipping invalid token: ${expoPushToken}`);
    return { sent: 0, failed: 0, skipped: 1, tickets: [] };
  }
  return sendPushToTokens([expoPushToken], message, data);
}

module.exports = {
  sendPushNotification,
  sendPushToTokens,
  isValidExpoToken,
  truncate,
};
