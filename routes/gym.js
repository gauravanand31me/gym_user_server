const express = require('express');

const { authMiddleware } = require('../middleware/authMiddleware');
const { fetchGyms } = require('../controllers/fetchGym');
const { fetchIndividualGyms } = require('../controllers/getIndividualGym');
const router = express.Router();



router.get('/get', authMiddleware, fetchGyms)
router.get('/get/:gymId', authMiddleware, fetchIndividualGyms)

module.exports = router;
