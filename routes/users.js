const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getNearbyUsers } = require('../controllers/getNearbyUsers');
const { getIndividualUser, searchUsersByUsernameOrLocation } = require('../controllers/getIndividualUser');
const router = express.Router();

router.get('/nearby-users', authMiddleware, searchUsersByUsernameOrLocation);
router.get('/get', authMiddleware, getIndividualUser);
router.get('/search/:username', authMiddleware, searchUsersByUsernameOrLocation);
module.exports = router;
