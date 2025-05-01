const multer = require('multer');
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/'];
    if (!allowedTypes.some(type => file.mimetype.startsWith(type))) {
      return cb(new Error('Only image and video files are allowed!'), false);
    }
    cb(null, true);
  },
});

module.exports = upload;
