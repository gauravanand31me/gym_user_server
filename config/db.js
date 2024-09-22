const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('fitzoos', 'postgres', 'Sourav@1992', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false,
});

sequelize.authenticate()
  .then(() => console.log('Database connected'))
  .catch(err => console.log('Error: ' + err));

  sequelize.sync({ alter: true }); // This will update the schema without dropping existing tables

module.exports = sequelize;



