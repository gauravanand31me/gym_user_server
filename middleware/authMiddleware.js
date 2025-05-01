const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || "Test@1992"

exports.authMiddleware = async (req, res, next) => {
  console.log("Headers received", req.headers);
  console.log("Route accessed:", req.method, req.originalUrl);  // 👈 log method + full URL

  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).send('No token provided');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) throw new Error('User not found');

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error on route", req.originalUrl, "->", error.message);
    res.status(401).send('Authentication failed');
  }
};

