const CalorieSnapTrial = require('../models/CalorieSnapTrial');
const CalorieLog = require('../models/CalorieLog');

const TRIAL_DAYS = 3;
const DAILY_LIMIT = 4;
const VALID_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function toYMD(d) {
  return d.toISOString().slice(0, 10);
}

// Parse "5g" → 5, or number → number
function parseGrams(val) {
  if (typeof val === 'number') return val;
  const m = String(val).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

// ─── GET /calorie-snap/trial-status ──────────────────────────────────────────

exports.getTrialStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const today = toYMD(now);

    const trial = await CalorieSnapTrial.findOne({ where: { userId } });

    // First-ever visit — no record yet
    if (!trial || !trial.firstUseDate) {
      return res.status(200).json({
        success: true,
        allowed: true,
        reason: null,
        daysLeft: TRIAL_DAYS,
        requestsLeft: DAILY_LIMIT,
        isNew: true,
      });
    }

    const daysSinceFirst = Math.floor((now - new Date(trial.firstUseDate)) / 86_400_000);

    if (daysSinceFirst >= TRIAL_DAYS) {
      return res.status(200).json({
        success: true,
        allowed: false,
        reason: 'expired',
        daysLeft: 0,
        requestsLeft: 0,
      });
    }

    const daysLeft = TRIAL_DAYS - daysSinceFirst;
    const todayEntry = (trial.usageLog || []).find(e => e.date === today);
    const todayCount = todayEntry ? todayEntry.count : 0;

    if (todayCount >= DAILY_LIMIT) {
      return res.status(200).json({
        success: true,
        allowed: false,
        reason: 'daily_limit',
        daysLeft,
        requestsLeft: 0,
      });
    }

    return res.status(200).json({
      success: true,
      allowed: true,
      reason: null,
      daysLeft,
      requestsLeft: DAILY_LIMIT - todayCount,
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
    const today = toYMD(new Date());

    let trial = await CalorieSnapTrial.findOne({ where: { userId } });

    if (!trial) {
      await CalorieSnapTrial.create({
        userId,
        firstUseDate: new Date(),
        usageLog: [{ date: today, count: 1 }],
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
    trial.changed('usageLog', true); // required for Sequelize JSONB mutation detection
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
      imageUri: imageUri || null,
      loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
      items,
      total,
      date: logDate,
    });

    return res.status(201).json({
      success: true,
      log: {
        id: String(log.id),
        mealLabel: log.mealLabel,
        loggedAt: log.loggedAt.toISOString(),
        total: log.total,
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
    const date = req.query.date || toYMD(new Date());

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
