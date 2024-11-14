const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getNearbyUsers } = require('../controllers/getNearbyUsers');
const upload = require('../middleware/upload');
const { getIndividualUser, searchUsersByUsernameOrLocation, uploadProfileImage,uploadPostImage,  getUserImage, updateFullName, deleteProfileImage } = require('../controllers/getIndividualUser');
const router = express.Router();

router.get('/nearby-users', authMiddleware, searchUsersByUsernameOrLocation);
router.get('/get', authMiddleware, getIndividualUser);
router.get('/search/:username', authMiddleware, searchUsersByUsernameOrLocation);
router.post('/uploadProfileImage', authMiddleware, upload.single('profileImage'), uploadProfileImage);
router.post('/uploadImage', authMiddleware, upload.single('postImage'), uploadPostImage);
router.get('/getImage/:userId', authMiddleware, getUserImage);
router.put('/update-fullname', authMiddleware, updateFullName);
router.put('/delete-profileimage', authMiddleware, deleteProfileImage);
module.exports = router;
