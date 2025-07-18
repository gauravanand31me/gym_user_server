require('dotenv').config(); // Load environment variables from .env file

console.log('Loaded environment variables:', process.env.DB_FITZOO_HOST); // Log all env variables
const express = require('express');
const sequelize = require('./config/db');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const gymRoutes = require('./routes/gym');
const bookingRoutes = require('./routes/booking');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const addressRoutes = require('./routes/address');
const buddyRoutes = require('./routes/buddy');3
const notificationRoutes = require('./routes/notification');
const ratingRoutes = require('./routes/rating');
const cors = require("cors");
const checkUserAgent = require('./checkUserAgent');

const app = express();
// app.use(bodyParser.json({ type: 'application/json' }));
app.use(express.json({
  limit: '200mb' ,
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cors());
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(checkUserAgent);

// Routes
app.use('/user/api/auth', authRoutes);
app.use('/user/api/gym', gymRoutes);
app.use('/user/api/booking', bookingRoutes);
app.use('/user/api/users', userRoutes);
app.use('/user/api/friends', friendRoutes);
app.use('/user/api/address', addressRoutes);
app.use('/user/api/buddy', buddyRoutes);
app.use('/user/api/notifications', notificationRoutes);
app.use('/user/api/rating', ratingRoutes);
const PORT = process.env.PORT || 5000;

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => console.log('Error: ' + err));
