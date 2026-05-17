const axios    = require('axios');
const jwt      = require('jsonwebtoken');
const { Op }   = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const User             = require('../models/User');
const PushNotification = require('../models/PushNotification');

const JWT_SECRET = process.env.JWT_SECRET || 'Test@1992';

// ─── Provider verification ────────────────────────────────────────────────────

async function verifyGoogle(accessToken) {
  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 8000,
  });
  // data: { sub, name, email, picture }
  return {
    socialId:   data.sub,
    email:      data.email    || null,
    fullName:   data.name     || 'Google User',
    profilePic: data.picture  || null,
  };
}

async function verifyFacebook(accessToken) {
  const { data } = await axios.get('https://graph.facebook.com/me', {
    params:  { fields: 'id,name,email,picture.type(large)', access_token: accessToken },
    timeout: 8000,
  });
  // data: { id, name, email?, picture }
  return {
    socialId:   data.id,
    email:      data.email                          || null,
    fullName:   data.name                           || 'Facebook User',
    profilePic: data.picture?.data?.url             || null,
  };
}

async function verifyTwitter(accessToken) {
  const { data } = await axios.get('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params:  { 'user.fields': 'id,name,profile_image_url' },
    timeout: 8000,
  });
  // data.data: { id, name, profile_image_url } — no email from Twitter
  return {
    socialId:   data.data.id,
    email:      null,
    fullName:   data.data.name                      || 'Twitter User',
    profilePic: data.data.profile_image_url         || null,
  };
}

const VERIFIERS = { google: verifyGoogle, facebook: verifyFacebook, twitter: verifyTwitter };

// ─── Username generator ───────────────────────────────────────────────────────

function makeUsername(fullName) {
  const base   = fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}_${suffix}`;
}

// ─── POST /auth/social-login ──────────────────────────────────────────────────

exports.socialLogin = async (req, res) => {
  const { provider, accessToken, expoPushToken } = req.body;

  if (!provider || !accessToken) {
    return res.status(400).json({ status: false, message: 'provider and accessToken are required' });
  }

  const verify = VERIFIERS[provider];
  if (!verify) {
    return res.status(400).json({ status: false, message: 'provider must be google, facebook, or twitter' });
  }

  // ── 1. Verify token with the provider ──────────────────────────────────────
  let providerData;
  try {
    providerData = await verify(accessToken);
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return res.status(401).json({ status: false, message: 'Invalid or expired access token' });
    }
    console.error(`socialLogin [${provider}] verify error:`, err.message);
    return res.status(502).json({ status: false, message: 'Failed to verify token with provider' });
  }

  const { socialId, email, fullName, profilePic } = providerData;

  // ── 2. Find existing user ──────────────────────────────────────────────────
  // Priority: email match first (links social to existing phone account),
  //           then social_provider + social_id
  let user = null;

  if (email) {
    user = await User.findOne({ where: { email } });
  }

  if (!user) {
    user = await User.findOne({ where: { social_provider: provider, social_id: socialId } });
  }

  // ── 3. Create new user if not found ───────────────────────────────────────
  if (!user) {
    // Generate a unique username (retry once on collision)
    let username = makeUsername(fullName);
    const collision = await User.findOne({ where: { username } });
    if (collision) username = makeUsername(fullName);

    // Placeholder mobile for social-only accounts (NOT NULL constraint)
    const placeholderMobile = `social_${uuidv4().replace(/-/g, '').slice(0, 20)}`;

    user = await User.create({
      full_name:       fullName,
      username,
      email:           email || null,
      mobile_number:   placeholderMobile,
      password:        uuidv4(), // random, bcrypt setter hashes it
      otp:             0,
      profile_pic:     profilePic || 'https://d59q7mzjlaq7y.cloudfront.net/thumbnails/empty.png',
      is_verified:     true,
      social_provider: provider,
      social_id:       socialId,
    });
  } else {
    // Link social account to existing user if not already linked
    const needsUpdate = user.social_provider !== provider || user.social_id !== socialId;
    if (needsUpdate) {
      await user.update({ social_provider: provider, social_id: socialId });
    }
  }

  // ── 4. Update push token ───────────────────────────────────────────────────
  if (expoPushToken) {
    const existing = await PushNotification.findOne({ where: { userId: user.id } });
    if (existing) {
      existing.expoPushToken = expoPushToken;
      await existing.save();
    } else {
      await PushNotification.create({ userId: user.id, expoPushToken });
    }
  }

  // ── 5. Return JWT ──────────────────────────────────────────────────────────
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '20d' });

  return res.status(200).json({
    status: true,
    token,
    data: {
      id:          user.id,
      full_name:   user.full_name,
      username:    user.username,
      email:       user.email,
      profile_pic: user.profile_pic,
    },
  });
};
