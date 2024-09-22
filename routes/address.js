const express = require('express');
const { addAddress, getAddress } = require('../controllers/addressController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/add', authMiddleware, addAddress);
router.get('/get',authMiddleware,  getAddress);


module.exports = router;
