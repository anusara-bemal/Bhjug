const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const analytics = require('./analytics');
const platformAuth = require('./platform_auth');
const { EventEmitter } = require('events');

class Uploader extends EventEmitter {
  constructor() {
    super();
    this.supportedPlatforms = {
      youtube: this.uploadToYoutube.bind(this),
      facebook: this.uploadToFacebook.bind(this),
      instagram: this.uploadToInstagram.bind(this),
      dailymotion: this.uploadToDailymotion.bind(this)
    };
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  async upload(filePath, platform, credentials, metadata = {}, userId) {
    let retries = 0;
    while (retries <= this.maxRetries) {
      try {
        if (!this.supportedPlatforms[platform]) {
          const error = `Platform '${platform}' is not supported. Available platforms: ${Object.keys(this.supportedPlatforms).join(', ')}`;
          await analytics.logNotification(userId, 'error', error, 'error');
          throw new Error(error);
        }

        if (!fs.existsSync(filePath)) {
          const error = 'The video file was not found. Please ensure the file exists.';
          await analytics.logNotification(userId, 'error', error, 'error');
          throw new Error(error);
        }

        const fileSize = fs.statSync(filePath).size;
        await analytics.logState(userId, 'upload', 'started', { platform, fileSize });
        this.emit('upload-start', { platform, fileSize });

        const auth = await platformAuth.authenticate(platform, credentials);
        const uploadFunction = this.supportedPlatforms[platform];
        const result = await uploadFunction(filePath, auth, metadata);

        this.emit('upload-complete', { platform, result });
        await analytics.logUpload(userId, platform, result.id, true);
        await analytics.logState(userId, 'upload', 'completed', { platform, result });
        await analytics.logNotification(userId, 'success', `Successfully uploaded video to ${platform}`);

        // Log video processing
        await analytics.logVideoProcessing(userId, path.basename(filePath), 'upload', 'success', {
          platform,
          fileId: result.id,
          url: result.url,
          size: fileSize
        });

        return result;
      } catch (error) {
        this.emit('upload-error', { platform, error: error.message });
        await analytics.logState(userId, 'upload', 'error', { platform, error: error.message });

        if (retries < this.maxRetries) {
          retries++;
          this.emit('upload-retry', { platform, attempt: retries });
          await analytics.logState(userId, 'upload', 'retrying', { platform, attempt: retries });
          await analytics.logNotification(userId, 'warning', `Retrying upload to ${platform} (Attempt ${retries}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }

        await analytics.logUpload(userId, platform, null, false, error);
        await analytics.logNotification(userId, 'error', `Failed to upload to ${platform}: ${error.message}`, 'error');
        throw error;
      }
    }
  }

  async uploadToYoutube(filePath, auth, metadata) {
    try {
      const { client } = auth;
      const fileSize = fs.statSync(filePath).size;
      let uploadedBytes = 0;

      const res = await client.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: metadata.title || path.basename(filePath),
            description: metadata.description || '',
            tags: metadata.tags || [],
            categoryId: metadata.categoryId || '22'
          },
          status: {
            privacyStatus: metadata.privacy || 'private',
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: fs.createReadStream(filePath)
          .on('data', chunk => {
            uploadedBytes += chunk.length;
            this.emit('upload-progress', {
              platform: 'youtube',
              progress: (uploadedBytes / fileSize) * 100
            });
          })
        }
      });

      return {
        id: res.data.id,
        url: `https://youtube.com/watch?v=${res.data.id}`,
        platform: 'youtube'
      };
    } catch (error) {
      throw new Error(`YouTube upload failed: ${error.message}`);
    }
  }

  async uploadToFacebook(filePath, auth, metadata) {
    try {
      const { client, userId } = auth;
      const fileSize = fs.statSync(filePath).size;
      let uploadedBytes = 0;
      
      return new Promise((resolve, reject) => {
        const uploadStream = fs.createReadStream(filePath);
        uploadStream.on('data', chunk => {
          uploadedBytes += chunk.length;
          this.emit('upload-progress', {
            platform: 'facebook',
            progress: (uploadedBytes / fileSize) * 100
          });
        });

        client.api(`/${userId}/videos`, 'POST', {
          source: uploadStream,
          title: metadata.title || path.basename(filePath),
          description: metadata.description || '',
          privacy: metadata.privacy || { value: 'SELF' }
        }, (response) => {
          if (!response || response.error) {
            reject(new Error(response?.error?.message || 'Facebook upload failed'));
            return;
          }
          
          resolve({
            id: response.id,
            url: `https://facebook.com/${response.id}`,
            platform: 'facebook'
          });
        });
      });
    } catch (error) {
      throw new Error(`Facebook upload failed: ${error.message}`);
    }
  }

  async uploadToInstagram(filePath, auth, metadata) {
    try {
      const { client } = auth;
      const fileSize = fs.statSync(filePath).size;
      let uploadedBytes = 0;
      
      const fileBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        fs.createReadStream(filePath)
          .on('data', chunk => {
            chunks.push(chunk);
            uploadedBytes += chunk.length;
            this.emit('upload-progress', {
              platform: 'instagram',
              progress: (uploadedBytes / fileSize) * 100
            });
          })
          .on('end', () => resolve(Buffer.concat(chunks)))
          .on('error', reject);
      });

      const publishResult = await client.publish.video({
        video: fileBuffer,
        caption: metadata.caption || '',
        location: metadata.location,
        usertags: metadata.usertags
      });

      return {
        id: publishResult.id,
        url: `https://instagram.com/p/${publishResult.code}`,
        platform: 'instagram'
      };
    } catch (error) {
      throw new Error(`Instagram upload failed: ${error.message}`);
    }
  }

  async uploadToDailymotion(filePath, auth, metadata) {
    try {
      const { spawn } = require('child_process');
      const pythonScript = path.join(__dirname, 'dailymotion_uploader.py');

      // Validate authentication
      if (!auth || !auth.accessToken) {
        throw new Error('Invalid authentication credentials');
      }

      // Validate file path and existence before proceeding
      const absolutePath = path.resolve(filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`The video file was not found at: ${absolutePath}`);
      }

      // Validate metadata
      if (!metadata || !metadata.title) {
        throw new Error('Video title is required');
      }

      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
          pythonScript,
          absolutePath,
          JSON.stringify({ accessToken: auth.accessToken })
        ]);

        let result = '';
        let error = '';

        pythonProcess.stdin.write(JSON.stringify(metadata));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
          try {
            const parsedData = JSON.parse(data.toString());
            if (parsedData.progress !== undefined) {
              this.emit('upload-progress', {
                platform: 'dailymotion',
                progress: parsedData.progress
              });
            } else if (parsedData.error) {
              error += parsedData.error;
            } else {
              result = parsedData;
            }
          } catch (e) {
            error += data.toString();
          }
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('error', (err) => {
          reject(new Error(`Failed to start Python process: ${err.message}`));
        });

        pythonProcess.on('close', (code) => {
          if (code === 0 && result) {
            resolve(result);
          } else {
            reject(new Error(`Dailymotion upload failed: ${error || 'Unknown error'}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Dailymotion upload failed: ${error.message}`);
    }
  }
}

module.exports = new Uploader();