const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || "Test@1992"
exports.authMiddleware = async (req, res, next) => {
  console.log("Headers received", req.headers);
  const token = req.header('Authorization').replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
   
    const user = await User.findByPk(decoded.id);

    if (!user) throw new Error('User not found');
    req.user = user;
    next();
  } catch (error) {
    res.status(401).send('Authentication failed');
  }
};
