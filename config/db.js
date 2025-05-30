require('dotenv').config(); // Load environment variables from .env file

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_FITZOO_DATABASE, process.env.DB_FITZOO_USERNAME, process.env.DB_FITZOO_PASSWORD, {
  host: process.env.DB_FITZOO_HOST,
  dialect: process.env.DB_FITZOO_DIALECT,
  logging: false,
  dialectOptions: {
    ssl: {
      require: true, // This will help you. But you will see nwe error
      rejectUnauthorized: false // This line will fix new error
    }
  },
});

sequelize.authenticate()
  .then(() => console.log('Database connected'))
  .catch(err => console.log('Error: ' + err));


  
sequelize.sync({ alter: true }); // This will update the schema without dropping existing tables

module.exports = sequelize;
