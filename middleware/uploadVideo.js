const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const fs = require('fs');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Use Multer memory storage to get the buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function uploadToS3(file) {
  const key = `reels/${Date.now()}-${path.basename(file.originalname)}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const parallelUpload = new Upload({
    client: s3Client,
    params: uploadParams,
  });

  await parallelUpload.done();

  return `https://${process.env.CLOUDFRONT_URL}/${key}`;
}

module.exports = { upload, uploadToS3 };
