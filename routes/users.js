const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getNearbyUsers } = require('../controllers/getNearbyUsers');
const { getIndividualUser, searchUserByUsername } = require('../controllers/getIndividualUser');
const router = express.Router();

router.get('/nearby-users', authMiddleware, getNearbyUsers);
router.get('/get', authMiddleware, getIndividualUser);
router.get('/search/:username', authMiddleware, searchUserByUsername);
module.exports = router;
