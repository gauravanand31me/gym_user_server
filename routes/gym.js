const express = require('express');

const { authMiddleware } = require('../middleware/authMiddleware');
const { fetchGyms } = require('../controllers/fetchGym');
const { fetchIndividualGyms, storePushToken } = require('../controllers/getIndividualGym');
const router = express.Router();



router.get('/get', fetchGyms)
router.get('/get/:gymId', fetchIndividualGyms)
router.put('/store', authMiddleware, storePushToken)

module.exports = router;
