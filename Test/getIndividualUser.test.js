const request = require('supertest');
const app = require('../server'); // Assuming server.js initializes the app
const { User } = require('../models/User');
const { sequelize } = require('../config/db');

jest.mock('../models/User');

beforeAll(async () => {
  await sequelize.sync();
});

afterAll(async () => {
  await sequelize.close();
});

test('Basic Jest Test', () => {
  expect(true).toBe(true);
});