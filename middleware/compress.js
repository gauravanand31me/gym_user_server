const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const compressVideo = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vcodec libx264',         // use better compression codec
        '-crf 28',                 // quality (lower = better, 23 is good, 28 is more compressed)
        '-preset fast',            // compression speed
        '-movflags +faststart'     // make the video start immediately
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
};
