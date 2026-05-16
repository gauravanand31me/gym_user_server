const UserBodyStats = require('../models/UserBodyStats');

// ─── GET /users/body-stats ────────────────────────────────────────────────────

exports.getBodyStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await UserBodyStats.findOne({ where: { userId } });

    return res.status(200).json({
      success: true,
      stats: stats
        ? {
            heightCm:  stats.heightCm,
            weightKg:  stats.weightKg,
            updatedAt: stats.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    console.error('getBodyStats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── PUT /users/body-stats ────────────────────────────────────────────────────

exports.updateBodyStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { heightCm, weightKg } = req.body;

    if (
      heightCm !== undefined &&
      (typeof heightCm !== 'number' || heightCm < 50 || heightCm > 300)
    ) {
      return res.status(400).json({ success: false, message: 'heightCm must be a number between 50 and 300' });
    }
    if (
      weightKg !== undefined &&
      (typeof weightKg !== 'number' || weightKg < 10 || weightKg > 500)
    ) {
      return res.status(400).json({ success: false, message: 'weightKg must be a number between 10 and 500' });
    }

    const [stats, created] = await UserBodyStats.findOrCreate({
      where: { userId },
      defaults: { userId, heightCm, weightKg },
    });

    if (!created) {
      if (heightCm !== undefined) stats.heightCm = heightCm;
      if (weightKg !== undefined) stats.weightKg = weightKg;
      await stats.save();
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('updateBodyStats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
