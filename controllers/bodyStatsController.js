const User = require('../models/User');

// ─── GET /users/body-stats ────────────────────────────────────────────────────

exports.getBodyStats = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['height', 'weight', 'muscle_mass', 'gender', 'updatedAt'],
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({
      success: true,
      stats: {
        height:      user.height,
        weight:      user.weight,
        muscle_mass: user.muscle_mass,
        gender:      user.gender,
        updatedAt:   user.updatedAt,
      },
    });
  } catch (err) {
    console.error('getBodyStats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── PUT /users/body-stats ────────────────────────────────────────────────────

exports.updateBodyStats = async (req, res) => {
  try {
    const { height, weight, muscle_mass, gender } = req.body;

    const updates = {};
    if (height      !== undefined) updates.height      = height;
    if (weight      !== undefined) updates.weight      = weight;
    if (muscle_mass !== undefined) updates.muscle_mass = muscle_mass;
    if (gender      !== undefined) updates.gender      = gender;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    await User.update(updates, { where: { id: req.user.id } });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('updateBodyStats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
