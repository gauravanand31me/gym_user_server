const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getNearbyUsers } = require('../controllers/getNearbyUsers');
const upload = require('../middleware/upload');
const { getIndividualUser, searchUsersByUsernameOrLocation, uploadProfileImage,uploadPostImage,  getUserImage, updateFullName, deleteProfileImage, deleteProfile, getTopUsersByWorkoutTime, getUserFeed, uploadFeed} = require('../controllers/getIndividualUser');
const { reactToPost } = require('../controllers/PostReaction');
const router = express.Router();

router.get('/nearby-users', authMiddleware, searchUsersByUsernameOrLocation);
router.get('/get', authMiddleware, getIndividualUser);
router.get('/search/:username', authMiddleware, searchUsersByUsernameOrLocation);
router.post('/uploadProfileImage', authMiddleware, upload.single('profileImage'), uploadProfileImage);
router.post('/uploadImage', authMiddleware, upload.single('postImage'), uploadPostImage);
router.get('/getImage/:userId', authMiddleware, getUserImage);
router.put('/update-fullname', authMiddleware, updateFullName);
router.put('/delete-profileimage', authMiddleware, deleteProfileImage);
router.delete('/deleteaccount', authMiddleware, deleteProfile);
router.get('/leaderboard',  getTopUsersByWorkoutTime);
router.get('/feed',  authMiddleware,  getUserFeed)
router.post('/feed/upload',  authMiddleware, upload.single('image'),  uploadFeed)
router.post('/feed/react', authMiddleware,  reactToPost)
module.exports = router;
