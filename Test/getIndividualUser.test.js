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

describe('GET /getIndividualUser', () => {
  it('should return the logged-in user details', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      full_name: 'Test User',
      profile_pic: 'https://example.com/profile.jpg',
    };

    User.findByPk.mockResolvedValue(mockUser);

    const response = await request(app)
      .get('/getIndividualUser')
      .set('Authorization', 'Bearer mockToken');

    expect(response.status).toBe(200);
    expect(response.body.loggedInUser).toEqual(mockUser);
  });

  it('should return 500 if an error occurs', async () => {
    User.findByPk.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .get('/getIndividualUser')
      .set('Authorization', 'Bearer mockToken');

    expect(response.status).toBe(500);
    expect(response.text).toBe('Server error');
  });
});