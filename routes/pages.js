const express = require('express');
const upload  = require('../middleware/upload');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  listPages,
  myPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  joinPage,
  leavePage,
  listPosts,
  createPost,
  deletePost,
} = require('../controllers/pagesController');

const router = express.Router();

const pageImages = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage',   maxCount: 1 },
]);

// Pages
router.get('/',      authMiddleware, listPages);
router.get('/my',    authMiddleware, myPages);
router.get('/:id',   authMiddleware, getPage);
router.post('/',     authMiddleware, pageImages, createPage);
router.put('/:id',   authMiddleware, pageImages, updatePage);
router.delete('/:id',authMiddleware, deletePage);

// Follow / Unfollow
router.post('/:id/join',  authMiddleware, joinPage);
router.delete('/:id/leave', authMiddleware, leavePage);

// Posts
router.get('/:id/posts',              authMiddleware, listPosts);
router.post('/:id/posts',             authMiddleware, upload.array('images', 10), createPost);
router.delete('/:id/posts/:postId',   authMiddleware, deletePost);

module.exports = router;
