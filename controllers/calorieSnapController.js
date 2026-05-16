const crypto = require('crypto');
const Razorpay = require('razorpay');
const shortid = require('shortid');
const { Op } = require('sequelize');

const CalorieSnapTrial        = require('../models/CalorieSnapTrial');
const CalorieLog              = require('../models/CalorieLog');
const CalorieSnapSubscription = require('../models/CalorieSnapSubscription');

const razorpay = new Razorpay({
  key_id:     process.env.RAZOR_PAY_PAYMENT_KEY,
  key_secret: process.env.RAZOR_PAY_PAYMENT_SECRET,
});

const PLANS = {
  monthly: { amount: 12900,  days: 30  },
  yearly:  { amount: 120000, days: 365 },
};

const TRIAL_DAYS  = 3;
const DAILY_LIMIT = 4;
const VALID_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

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

    // 1. Active subscription takes priority — unlimited access
    const subscription = await CalorieSnapSubscription.findOne({
      where: {
        userId,
        status:    'active',
        expiresAt: { [Op.gt]: now },
      },
    });

    if (subscription) {
      return res.status(200).json({
        success:      true,
        allowed:      true,
        reason:       'subscribed',
        daysLeft:     null,
        requestsLeft: null,
        isSubscribed: true,
      });
    }

    // 2. Check free trial
    const trial = await CalorieSnapTrial.findOne({ where: { userId } });

    if (!trial || !trial.firstUseDate) {
      return res.status(200).json({
        success:      true,
        allowed:      true,
        reason:       null,
        daysLeft:     TRIAL_DAYS,
        requestsLeft: DAILY_LIMIT,
        isNew:        true,
        isSubscribed: false,
      });
    }

    const daysSinceFirst = Math.floor((now - new Date(trial.firstUseDate)) / 86_400_000);

    if (daysSinceFirst >= TRIAL_DAYS) {
      return res.status(200).json({
        success:      true,
        allowed:      false,
        reason:       'expired',
        daysLeft:     0,
        requestsLeft: 0,
        isSubscribed: false,
      });
    }

    const daysLeft    = TRIAL_DAYS - daysSinceFirst;
    const todayEntry  = (trial.usageLog || []).find(e => e.date === today);
    const todayCount  = todayEntry ? todayEntry.count : 0;

    if (todayCount >= DAILY_LIMIT) {
      return res.status(200).json({
        success:      true,
        allowed:      false,
        reason:       'daily_limit',
        daysLeft,
        requestsLeft: 0,
        isSubscribed: false,
      });
    }

    return res.status(200).json({
      success:      true,
      allowed:      true,
      reason:       null,
      daysLeft,
      requestsLeft: DAILY_LIMIT - todayCount,
      isSubscribed: false,
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

    if (!trial.firstUseDate) {
      trial.firstUseDate = new Date();
    }

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
    const userId = req.user.id;
    const { plan } = req.body;

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ success: false, message: 'plan must be "monthly" or "yearly"' });
    }

    const { amount } = PLANS[plan];

    const link = await razorpay.paymentLink.create({
      amount,
      currency: 'INR',
      description: `CalorieSnap ${plan} subscription`,
      receipt: `cs_${shortid.generate()}`,
      notify: { sms: false, email: false },
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
    });
  } catch (err) {
    console.error('createPaymentLink error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /calorie-snap/create-order ─────────────────────────────────────────

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ success: false, message: 'plan must be "monthly" or "yearly"' });
    }

    const { amount } = PLANS[plan];

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
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } = req.body;

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

    // Find the pending order
    const subscription = await CalorieSnapSubscription.findOne({
      where: { orderId: razorpay_order_id, status: 'pending' },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Order not found or already processed' });
    }

    // Resolve expiry using the plan on the DB record (not trusting client)
    const resolvedPlan = subscription.plan;
    const days         = PLANS[resolvedPlan]?.days ?? 30;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    subscription.status    = 'active';
    subscription.paymentId = razorpay_payment_id;
    subscription.expiresAt = expiresAt;
    await subscription.save();

    return res.status(200).json({
      success:   true,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('verifyPayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
