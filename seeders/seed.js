const { Sequelize } = require('sequelize');
const UserAddress = require('../models/UserAddress'); // Adjust this path based on your project structure
const sequelize = require('../config/db'); // Adjust this path as needed

const addresses = [
  {
    user_id: "01e113b3-41f9-4582-a164-8ac6ea40d6f9",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '1 MG Road',
    address_line_2: 'Near Brigade Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    created_on: new Date(),
    is_selected: true
  },
  {
    user_id: "7d702ec4-d48b-45c0-b5f7-eff5693aa2a2",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '2 Indiranagar',
    address_line_2: 'Near 100 Feet Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560038',
    created_on: new Date(),
    is_selected: false
  },
  {
    user_id: "8af8f7db-2c2e-458b-aa45-4c8017a11088",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '3 Koramangala',
    address_line_2: 'Near Forum Mall',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560047',
    created_on: new Date(),
    is_selected: true
  },
  {
    user_id: "9fab666d-3ae2-4422-b74a-ca7c3f631b06",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '4 Whitefield',
    address_line_2: 'Near ITPL',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560066',
    created_on: new Date(),
    is_selected: false
  },
  {
    user_id: "acf4d64d-743e-4cb0-9cce-c43e8c365385",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '5 Jayanagar',
    address_line_2: 'Near 4th Block',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560011',
    created_on: new Date(),
    is_selected: true
  },
  {
    user_id: "b532c12a-b514-4946-bf42-7f85f740483f",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '6 Malleshwaram',
    address_line_2: 'Near 18th Cross',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560003',
    created_on: new Date(),
    is_selected: false
  },
  {
    user_id: "b632c12a-b514-4946-bf42-7f05f740483f",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '7 Sadashivanagar',
    address_line_2: 'Near Raj Bhavan',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560080',
    created_on: new Date(),
    is_selected: true
  },
  {
    user_id: "b632c12a-b514-4946-bf42-7f85f740483f",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '8 HSR Layout',
    address_line_2: 'Near Agara Lake',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560102',
    created_on: new Date(),
    is_selected: false
  },
  {
    user_id: "b632c12a-b524-4946-bf42-7f05f740483f",
    lat: 12.9716,
    long: 77.5946,
    address_line_1: '9 Electronic City',
    address_line_2: 'Near Infosys',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560100',
    created_on: new Date(),
    is_selected: true
  },
];

const seedDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    // Sync models (optional, based on your needs)
    await sequelize.sync({ force: true }); // Use { force: true } to drop and recreate tables

    // Bulk create addresses
    await UserAddress.bulkCreate(addresses);
    console.log('Seed data inserted successfully');
  } catch (error) {
    console.error('Error inserting seed data:', error);
  } finally {
    await sequelize.close();
  }
};

seedDatabase();
