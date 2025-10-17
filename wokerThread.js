const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const sharp = require('sharp');
const Reel = require('./models/Reel');
const Feed = require('./models/Feed');
const { s3Client, PutObjectCommand } = require('./s3Client');

ffmpeg.setFfmpegPath(ffmpegPath);


const compressVideo = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .inputOption('-hwaccel auto')
      .outputOptions([
        '-vf', 'fps=30,scale=1280:-2,format=yuv420p',
        '-pix_fmt', 'yuv420p',
        '-vsync', 'vfr',
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-crf', '28',
        '-preset', 'veryfast',
        '-movflags', '+faststart',
        '-f', 'mp4',
      ])
      .on('start', cmd => {
        console.log('🎬 ffmpeg started:', cmd);
      })
      .on('stderr', stderrLine => {
        console.log('⚙️ ffmpeg stderr:', stderrLine);
      })
      .on('end', () => {
        console.log('✅ Video compression complete');
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('❌ ffmpeg failed:', err.message);
        console.error('stdout:', stdout);
        console.error('stderr:', stderr);
        reject(err);
      });

    try {
      command.save(outputPath);
    } catch (err) {
      console.error('💥 Synchronous ffmpeg crash:', err.message);
      reject(err);
    }
  });
};


const generateThumbnail = (inputPath, thumbnailPath) =>
    new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('end', () => resolve(thumbnailPath))
        .on('error', reject)
        .screenshots({
          timestamps: ['1'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '640x?',
        });
 });


async function processPendingReels() {
  const reels = await Reel.findAll({ where: { processing: true } });

  for (const reel of reels) {
    const inputPath = reel.rawFilePath;
    const compressedPath = path.join(__dirname, '../temp', `compressed-${Date.now()}.mp4`);
    const rawThumbnailJpg = path.join(__dirname, '../temp', `thumbnail-${Date.now()}.jpg`);
    const finalThumbnailWebp = rawThumbnailJpg.replace(/\.jpg$/, '.webp');

    try {
      // Compress video
      await compressVideo(inputPath, compressedPath);

      // Generate thumbnail
      await generateThumbnail(inputPath, rawThumbnailJpg);
      await sharp(rawThumbnailJpg).webp({ quality: 90 }).toFile(finalThumbnailWebp);
      fs.unlinkSync(rawThumbnailJpg);

      // Upload to S3
      const s3VideoKey = `reels/${Date.now()}-compressed.mp4`;
      const s3ThumbnailKey = `reels/thumbnails/${Date.now()}-thumbnail.webp`;

      await Promise.all([
        s3Client.send(new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: s3VideoKey,
          Body: fs.createReadStream(compressedPath),
          ContentType: 'video/mp4',
          CacheControl: 'public, max-age=31536000',
        })),
        s3Client.send(new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: s3ThumbnailKey,
          Body: fs.createReadStream(finalThumbnailWebp),
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000',
        })),
      ]);

      const videoUrl = `https://${process.env.CLOUDFRONT_URL}/${s3VideoKey}`;
      const thumbnailUrl = `https://${process.env.CLOUDFRONT_URL}/${s3ThumbnailKey}`;

      // Update Reel & Feed
      await reel.update({ videoUrl, thumbnailUrl, processing: false });
      const feed = await Feed.findByPk(reel.id);
      if (feed) {
        await feed.update({ imageUrl: thumbnailUrl });
      }

    } catch (err) {
      console.error(`❌ Failed to process Reel ${reel.id}:`, err);
    } finally {
      [inputPath, compressedPath, finalThumbnailWebp].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    }
  }

  // Repeat every few seconds
  setTimeout(processPendingReels, 5000);
}

// Start the worker loop
processPendingReels();
