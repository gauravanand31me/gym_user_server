const request = require('supertest');
const app = require('../server'); // Assuming server.js initializes the app

const { sequelize } = require('../config/db');



test('Basic Jest Test', () => {
  expect(true).toBe(true);
});