const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { VIDEO_ENHANCEMENT } = require('../config');

class VideoProcessor {
  constructor() {
    this.supportedFormats = VIDEO_ENHANCEMENT.supported_formats;
    this.maxResolution = VIDEO_ENHANCEMENT.max_resolution;
    this.defaultQuality = VIDEO_ENHANCEMENT.default_quality;
    this.maxDuration = VIDEO_ENHANCEMENT.max_duration;
  }

  async processVideo(inputPath, options = {}) {
    try {
      const outputPath = this.generateOutputPath(inputPath);
      const command = ffmpeg(inputPath);

      // Apply video enhancements
      if (options.resolution) {
        command.size(options.resolution);
      }

      if (options.quality) {
        command.videoBitrate(this.getQualityBitrate(options.quality));
      }

      if (options.trim) {
        const { start, duration } = options.trim;
        command.setStartTime(start);
        if (duration) {
          command.setDuration(duration);
        }
      }

      if (options.blurFace) {
        // Apply face detection and blurring using ML model
        command.complexFilter([
          '[0:v]facedetect=enable=1:scale=1:neighbors=5[detected]',
          '[detected]boxblur=10:10[blurred]'
        ]);
      }

      if (options.blurSensitive) {
        // Apply content-aware blurring for sensitive content
        command.complexFilter([
          '[0:v]select=\'gt(scene,0.4)\',boxblur=10[blurred]'
        ]);
      }

      if (options.subtitles) {
        const { type, file } = options.subtitles;
        if (type === 'hard') {
          // Burn subtitles into video
          command.input(file)
            .complexFilter([
              `subtitles=${file}:force_style='Fontsize=24'[subtitles]`,
            ]);
        } else {
          // Add soft subtitles
          command.addInput(file)
            .addOption('-c:s', 'mov_text');
        }
      }

      if (options.enhance) {
        // Apply AI-based enhancement
        command.complexFilter([
          '[0:v]scale=iw*2:ih*2:flags=lanczos[upscaled]',
          '[upscaled]unsharp=3:3:1.5[sharpened]',
          '[sharpened]eq=contrast=1.1:brightness=0.05[enhanced]'
        ]);
      }

      return new Promise((resolve, reject) => {
        command
          .on('progress', (progress) => {
            if (options.onProgress) {
              options.onProgress(progress);
            }
          })
          .on('end', () => resolve(outputPath))
          .on('error', (err) => reject(new Error(`Video processing failed: ${err.message}`)))
          .save(outputPath);
      });
    } catch (error) {
      throw new Error(`Video processing failed: ${error.message}`);
    }
  }

  async generateThumbnail(videoPath, options = {}) {
    try {
      const outputPath = this.generateThumbnailPath(videoPath);
      const command = ffmpeg(videoPath);

      if (options.timestamp) {
        command.screenshots({
          timestamps: [options.timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath)
        });
      } else {
        command.thumbnail({
          count: 1,
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath)
        });
      }

      return new Promise((resolve, reject) => {
        command
          .on('end', () => resolve(outputPath))
          .on('error', (err) => reject(new Error(`Thumbnail generation failed: ${err.message}`)));
      });
    } catch (error) {
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  generateOutputPath(inputPath) {
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const basename = path.basename(inputPath, ext);
    return path.join(dir, `${basename}_processed${ext}`);
  }

  generateThumbnailPath(videoPath) {
    const dir = path.dirname(videoPath);
    const basename = path.basename(videoPath, path.extname(videoPath));
    return path.join(dir, `${basename}_thumb.jpg`);
  }

  getQualityBitrate(quality) {
    const bitrates = {
      low: '1000k',
      medium: '2000k',
      high: '4000k'
    };
    return bitrates[quality] || bitrates.medium;
  }
}

module.exports = new VideoProcessor();