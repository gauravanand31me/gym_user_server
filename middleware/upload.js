const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'application/pdf'];

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
  '.heic', '.heif',       // iPhone camera formats
  '.mp4', '.mov', '.avi', '.mkv', '.m4v',
  '.pdf',
]);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB cap
  fileFilter: (req, file, cb) => {
    const mimeOk = ALLOWED_MIME_PREFIXES.some(t => file.mimetype.startsWith(t));

    // React Native sometimes sends camera images as application/octet-stream —
    // fall back to the file extension in that case
    const ext = path.extname(file.originalname).toLowerCase();
    const extOk = file.mimetype === 'application/octet-stream' && ALLOWED_EXTENSIONS.has(ext);

    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image, video, and PDF files are allowed!'), false);
    }
  },
});

module.exports = upload;
