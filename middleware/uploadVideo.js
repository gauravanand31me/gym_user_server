const multer = require('multer');

// 🔥 Store file in memory (NOT disk)
const storage = multer.memoryStorage();

const uploadVideo = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 100MB (adjust if needed)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

module.exports = uploadVideo;