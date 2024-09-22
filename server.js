const express = require('express');
const sequelize = require('./config/db');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const gymRoutes = require('./routes/gym');
const bookingRoutes = require('./routes/booking');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gym', gymRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
const PORT = process.env.PORT || 5000;

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => console.log('Error: ' + err));
