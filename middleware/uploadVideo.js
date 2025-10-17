const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('@aws-sdk/client-s3');

// Initialize S3 client
const s3Client = new AWS.S3({
  region: process.env.AWS_REGION, // e.g., 'us-east-1'
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer S3 storage configuration
const uploadVideo = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME, // your bucket name
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const filename = `reels/${Date.now()}-${file.originalname}`;
      cb(null, filename);
    },
  }),
});

module.exports = uploadVideo;
