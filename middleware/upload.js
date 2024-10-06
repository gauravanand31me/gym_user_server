// middleware/upload.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/aws');

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        key: (req, file, cb) => {
            const userId = req.user.id; // Assuming req.user is populated
            const fileName = `${userId}/profile_${Date.now()}.jpg`;
            cb(null, fileName);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

module.exports = upload;