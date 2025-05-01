const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const s3 = require('../config/aws');

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = req.user.id; // Assuming req.user is populated by auth middleware
      const extension = path.extname(file.originalname); // get original file extension
      const fileName = `${userId}/${Date.now()}_${file.fieldname}${extension}`;
      cb(null, fileName);
    },
    // ❌ REMOVE THIS or ensure it’s not added implicitly
    // acl: 'public-read',  <== DO NOT USE THIS IF ACLs ARE DISABLED
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/'];
    if (!allowedTypes.some(type => file.mimetype.startsWith(type))) {
      return cb(new Error('Only image and video files are allowed!'), false);
    }
    cb(null, true);
  },
});

module.exports = upload;
