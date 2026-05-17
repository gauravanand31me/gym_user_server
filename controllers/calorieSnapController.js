const crypto   = require('crypto');
const Razorpay = require('razorpay');
const shortid  = require('shortid');
const { Op }   = require('sequelize');

const CalorieSnapTrial        = require('../models/CalorieSnapTrial');
const CalorieLog              = require('../models/CalorieLog');
const CalorieSnapSubscription = require('../models/CalorieSnapSubscription');
const CalorieSnapConfig       = require('../models/CalorieSnapConfig');

const razorpay = new Razorpay({
  key_id:     process.env.RAZOR_PAY_PAYMENT_KEY,
  key_secret: process.env.RAZOR_PAY_PAYMENT_SECRET,
});

const PLAN_DAYS  = { monthly: 30, yearly: 365 };
const VALID_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// ─── Config cache (refreshed every 60 s) ─────────────────────────────────────

let _configCache      = null;
let _configCacheUntil = 0;

async function getConfig() {
  if (_configCache && Date.now() < _configCacheUntil) return _configCache;

  const [config] = await CalorieSnapConfig.findOrCreate({
    where:    { id: 1 },
    defaults: { monthlyPrice: 12900, yearlyPrice: 120000, trialDays: 3, dailyLimit: 4 },
  });

  _configCache      = config;
  _configCacheUntil = Date.now() + 60_000;
  return config;
}

function invalidateConfigCache() {
  _configCache      = null;
  _configCacheUntil = 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(d) {
  return d.toISOString().slice(0, 10);
}

function parseGrams(val) {
  if (typeof val === 'number') return val;
  const m = String(val).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

// ─── GET /calorie-snap/trial-status ──────────────────────────────────────────

exports.getTrialStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const now    = new Date();
    const today  = toYMD(now);
    const cfg    = await getConfig();

    // 1. Active subscription → unlimited, no trial limits apply
    const subscription = await CalorieSnapSubscription.findOne({
      where: { userId, status: 'active', expiresAt: { [Op.gt]: now } },
    });

    if (subscription) {
      return res.status(200).json({
        success:      true,
        allowed:      true,
        reason:       'subscribed',
        daysLeft:     null,
        requestsLeft: null,
        isSubscribed: true,
        plan:         subscription.plan,
        expiresAt:    subscription.expiresAt.toISOString(),
      });
    }

    // 2. Free trial check
    const trial = await CalorieSnapTrial.findOne({ where: { userId } });

    if (!trial || !trial.firstUseDate) {
      return res.status(200).json({
        success:      true,
        allowed:      true,
        reason:       null,
        daysLeft:     cfg.trialDays,
        requestsLeft: cfg.dailyLimit,
        isNew:        true,
        isSubscribed: false,
        plan:         null,
        expiresAt:    null,
      });
    }

    const daysSinceFirst = Math.floor((now - new Date(trial.firstUseDate)) / 86_400_000);

    if (daysSinceFirst >= cfg.trialDays) {
      return res.status(200).json({
        success:      true,
        allowed:      false,
        reason:       'expired',
        daysLeft:     0,
        requestsLeft: 0,
        isSubscribed: false,
        plan:         null,
        expiresAt:    null,
      });
    }

    const daysLeft   = cfg.trialDays - daysSinceFirst;
    const todayEntry = (trial.usageLog || []).find(e => e.date === today);
    const todayCount = todayEntry ? todayEntry.count : 0;

    if (todayCount >= cfg.dailyLimit) {
      return res.status(200).json({
        success:      true,
        allowed:      false,
        reason:       'daily_limit',
        daysLeft,
        requestsLeft: 0,
        isSubscribed: false,
        plan:         null,
        expiresAt:    null,
      });
    }

    return res.status(200).json({
      success:      true,
      allowed:      true,
      reason:       null,
      daysLeft,
      requestsLeft: cfg.dailyLimit - todayCount,
      isSubscribed: false,
      plan:         null,
      expiresAt:    null,
    });
  } catch (err) {
    console.error('getTrialStatus error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /calorie-snap/record-usage ─────────────────────────────────────────

exports.recordUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = toYMD(new Date());

    let trial = await CalorieSnapTrial.findOne({ where: { userId } });

    if (!trial) {
      await CalorieSnapTrial.create({
        userId,
        firstUseDate: new Date(),
        usageLog:     [{ date: today, count: 1 }],
      });
      return res.status(200).json({ success: true });
    }

    if (!trial.firstUseDate) trial.firstUseDate = new Date();

    const log = [...(trial.usageLog || [])];
    const idx = log.findIndex(e => e.date === today);

    if (idx >= 0) {
      log[idx] = { date: today, count: log[idx].count + 1 };
    } else {
      log.push({ date: today, count: 1 });
    }

    trial.usageLog = log;
    trial.changed('usageLog', true);
    await trial.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('recordUsage error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /calorie-snap/log ───────────────────────────────────────────────────

exports.saveCalorieLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mealLabel, imageUri, loggedAt, items, total } = req.body;

    if (!mealLabel || !VALID_MEALS.includes(mealLabel)) {
      return res.status(400).json({
        success: false,
        message: `mealLabel must be one of: ${VALID_MEALS.join(', ')}`,
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
    }
    if (!total || typeof total.calories !== 'number' || total.calories <= 0) {
      return res.status(400).json({ success: false, message: 'total.calories must be a positive number' });
    }

    const logDate = loggedAt ? toYMD(new Date(loggedAt)) : toYMD(new Date());

    const log = await CalorieLog.create({
      userId,
      mealLabel,
      imageUri:  imageUri || null,
      loggedAt:  loggedAt ? new Date(loggedAt) : new Date(),
      items,
      total,
      date: logDate,
    });

    return res.status(201).json({
      success: true,
      log: {
        id:        String(log.id),
        mealLabel: log.mealLabel,
        loggedAt:  log.loggedAt.toISOString(),
        total:     log.total,
      },
    });
  } catch (err) {
    console.error('saveCalorieLog error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /calorie-snap/logs ───────────────────────────────────────────────────

exports.getCalorieLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const date   = req.query.date || toYMD(new Date());

    const logs = await CalorieLog.findAll({
      where: { userId, date },
      order: [['loggedAt', 'ASC']],
    });

    const summary = logs.reduce(
      (acc, l) => {
        acc.calories += l.total.calories || 0;
        acc.protein  += parseGrams(l.total.protein);
        acc.carbs    += parseGrams(l.total.carbs);
        acc.fat      += parseGrams(l.total.fat);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return res.status(200).json({
      success: true,
      logs: logs.map(l => ({
        id:        String(l.id),
        mealLabel: l.mealLabel,
        loggedAt:  l.loggedAt.toISOString(),
        items:     l.items,
        total:     l.total,
      })),
      summary: {
        calories:  Math.round(summary.calories),
        protein:   summary.protein + 'g',
        carbs:     summary.carbs + 'g',
        fat:       summary.fat + 'g',
        mealCount: logs.length,
      },
    });
  } catch (err) {
    console.error('getCalorieLogs error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /calorie-snap/create-payment-link ──────────────────────────────────

exports.createPaymentLink = async (req, res) => {
  try {
    const userId  = req.user.id;
    const { plan } = req.body;
    const cfg     = await getConfig();

    const prices = { monthly: cfg.monthlyPrice, yearly: cfg.yearlyPrice };

    if (!plan || !prices[plan]) {
      return res.status(400).json({ success: false, message: 'plan must be "monthly" or "yearly"' });
    }

    const amount = prices[plan];

    const link = await razorpay.paymentLink.create({
      amount,
      currency:     'INR',
      description:  `CalorieSnap ${plan} subscription`,
      reference_id: `cs_${shortid.generate()}`,
      notify:       { sms: false, email: false },
    });

    await CalorieSnapSubscription.create({
      userId,
      plan,
      orderId: link.id,
      amount,
      status: 'pending',
    });

    return res.status(200).json({
      success:     true,
      paymentLink: link.short_url,
      linkId:      link.id,
      amount,
      currency:    'INR',
    });
  } catch (err) {
    console.error('createPaymentLink error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /calorie-snap/create-order ─────────────────────────────────────────

exports.createOrder = async (req, res) => {
  try {
    const userId  = req.user.id;
    const { plan } = req.body;
    const cfg     = await getConfig();

    const prices = { monthly: cfg.monthlyPrice, yearly: cfg.yearlyPrice };

    if (!plan || !prices[plan]) {
      return res.status(400).json({ success: false, message: 'plan must be "monthly" or "yearly"' });
    }

    const amount = prices[plan];

    const order = await razorpay.orders.create({
      amount,
      currency:        'INR',
      receipt:         `cs_${shortid.generate()}`,
      payment_capture: 1,
    });

    await CalorieSnapSubscription.create({
      userId,
      plan,
      orderId: order.id,
      amount,
      status: 'pending',
    });

    return res.status(200).json({
      success:  true,
      orderId:  order.id,
      amount,
      currency: 'INR',
      keyId:    process.env.RAZOR_PAY_PAYMENT_KEY,
    });
  } catch (err) {
    console.error('createOrder error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /calorie-snap/verify-payment ───────────────────────────────────────

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment fields' });
    }

    // Verify HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZOR_PAY_PAYMENT_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Find the pending subscription by Razorpay order ID
    const subscription = await CalorieSnapSubscription.findOne({
      where: { orderId: razorpay_order_id, status: 'pending' },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Order not found or already processed' });
    }

    // Calculate expiry from the plan stored in DB (never trust client)
    const days      = PLAN_DAYS[subscription.plan] ?? 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Activate subscription
    subscription.status    = 'active';
    subscription.paymentId = razorpay_payment_id;
    subscription.expiresAt = expiresAt;
    await subscription.save();

    // Reset trial scan counts so the user starts fresh as a subscriber
    await CalorieSnapTrial.update(
      { usageLog: [] },
      { where: { userId: subscription.userId } }
    );

    return res.status(200).json({
      success:      true,
      plan:         subscription.plan,
      expiresAt:    expiresAt.toISOString(),
      isSubscribed: true,
    });
  } catch (err) {
    console.error('verifyPayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /calorie-snap/subscription ──────────────────────────────────────────

exports.getSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const now    = new Date();

    const subscription = await CalorieSnapSubscription.findOne({
      where:  { userId, status: 'active', expiresAt: { [Op.gt]: now } },
      order:  [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success:      true,
      isSubscribed: !!subscription,
      subscription: subscription
        ? {
            plan:      subscription.plan,
            status:    subscription.status,
            amount:    subscription.amount,
            expiresAt: subscription.expiresAt.toISOString(),
            paymentId: subscription.paymentId,
            startedAt: subscription.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    console.error('getSubscription error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /calorie-snap/config ─────────────────────────────────────────────────

exports.getAppConfig = async (req, res) => {
  try {
    const cfg = await getConfig();

    return res.status(200).json({
      success: true,
      config: {
        monthlyPrice:    cfg.monthlyPrice,             // paise
        yearlyPrice:     cfg.yearlyPrice,              // paise
        monthlyPriceInr: cfg.monthlyPrice / 100,       // ₹
        yearlyPriceInr:  cfg.yearlyPrice  / 100,       // ₹
        trialDays:       cfg.trialDays,
        dailyLimit:      cfg.dailyLimit,
      },
    });
  } catch (err) {
    console.error('getAppConfig error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── PUT /calorie-snap/config  (admin) ───────────────────────────────────────

exports.updateAppConfig = async (req, res) => {
  try {
    const { monthlyPrice, yearlyPrice, trialDays, dailyLimit } = req.body;

    const [cfg] = await CalorieSnapConfig.findOrCreate({
      where:    { id: 1 },
      defaults: { monthlyPrice: 12900, yearlyPrice: 120000, trialDays: 3, dailyLimit: 4 },
    });

    if (monthlyPrice !== undefined) {
      if (typeof monthlyPrice !== 'number' || monthlyPrice <= 0)
        return res.status(400).json({ success: false, message: 'monthlyPrice must be a positive number in paise' });
      cfg.monthlyPrice = monthlyPrice;
    }
    if (yearlyPrice !== undefined) {
      if (typeof yearlyPrice !== 'number' || yearlyPrice <= 0)
        return res.status(400).json({ success: false, message: 'yearlyPrice must be a positive number in paise' });
      cfg.yearlyPrice = yearlyPrice;
    }
    if (trialDays !== undefined) {
      if (typeof trialDays !== 'number' || trialDays < 0)
        return res.status(400).json({ success: false, message: 'trialDays must be 0 or greater' });
      cfg.trialDays = trialDays;
    }
    if (dailyLimit !== undefined) {
      if (typeof dailyLimit !== 'number' || dailyLimit < 1)
        return res.status(400).json({ success: false, message: 'dailyLimit must be at least 1' });
      cfg.dailyLimit = dailyLimit;
    }

    await cfg.save();
    invalidateConfigCache();

    return res.status(200).json({
      success: true,
      config: {
        monthlyPrice:    cfg.monthlyPrice,
        yearlyPrice:     cfg.yearlyPrice,
        monthlyPriceInr: cfg.monthlyPrice / 100,
        yearlyPriceInr:  cfg.yearlyPrice  / 100,
        trialDays:       cfg.trialDays,
        dailyLimit:      cfg.dailyLimit,
      },
    });
  } catch (err) {
    console.error('updateAppConfig error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
