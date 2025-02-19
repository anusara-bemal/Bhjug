const ytdl = require('ytdl-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { DOWNLOAD_PATH, MAX_FILE_SIZE, VIDEO_ENHANCEMENT } = require('../config');
const analytics = require('./analytics');

class Downloader {
  constructor() {
    this.supportedPlatforms = {
      youtube: this.downloadFromYoutube.bind(this),
      tiktok: this.downloadFromTiktok.bind(this),
      facebook: this.downloadFromFacebook.bind(this),
      dailymotion: this.downloadFromDailymotion.bind(this),
      instagram: this.downloadFromInstagram.bind(this)
    };
  }

  async download(url, platform, userId) {
    try {
      await analytics.logState(userId, 'download', 'started', { url, platform });

      if (!url || typeof url !== 'string') {
        const error = 'Please provide a valid URL';
        await analytics.logNotification(userId, 'error', error, 'error');
        throw new Error(error);
      }

      url = url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const error = 'The URL must start with http:// or https://';
        await analytics.logNotification(userId, 'error', error, 'error');
        throw new Error(error);
      }

      if (!this.supportedPlatforms[platform]) {
        const error = `Platform '${platform}' is not supported. Available platforms: ${Object.keys(this.supportedPlatforms).join(', ')}`;
        await analytics.logNotification(userId, 'error', error, 'error');
        throw new Error(error);
      }

      await analytics.logState(userId, 'download', 'downloading', { url, platform });
      const downloadFunction = this.supportedPlatforms[platform];
      const filePath = await downloadFunction(url);

      // Validate file exists and is accessible
      if (!fs.existsSync(filePath)) {
        throw new Error('Downloaded file not found');
      }

      // Validate file size after download
      await this.validateFileSize(filePath);

      // Verify file is readable
      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch (error) {
        throw new Error('Downloaded file is not accessible');
      }

      const fileStats = await fs.promises.stat(filePath);
      if (fileStats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      await analytics.logDownload(userId, platform, url, true);
      await analytics.logState(userId, 'download', 'completed', { url, platform, filePath });
      await analytics.logNotification(userId, 'success', `Download complete! Choose editing options: \n1. Trim video\n2. Add watermark\n3. Adjust quality\n4. Proceed to upload`);

      // Log video processing
      await analytics.logVideoProcessing(userId, path.basename(filePath), 'download', 'success', {
        platform,
        url,
        size: fileStats.size,
        path: filePath
      });

      return {
        filePath,
        fileName: path.basename(filePath),
        fileSize: fileStats.size,
        downloadStatus: 'success'
      };
    } catch (error) {
      await analytics.logDownload(userId, platform, url, false, error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async downloadFromYoutube(url) {
    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highest',
        filter: 'videoandaudio'
      });

      if (!format) {
        throw new Error('No suitable format found');
      }

      const fileName = `youtube_${info.videoDetails.videoId}.mp4`;
      const filePath = path.join(DOWNLOAD_PATH, fileName);

      return new Promise((resolve, reject) => {
        const stream = ytdl(url, { format })
          .pipe(fs.createWriteStream(filePath));

        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
      });
    } catch (error) {
      if (error.message === 'Invalid YouTube URL') {
        throw error;
      }
      throw new Error(`YouTube download failed: ${error.message}`);
    }
  }

  async downloadFromTiktok(url) {
    try {
      // Extract video ID from URL
      const videoId = url.match(/\/@[\w.-]+\/video\/(\d+)/)?.[1];
      if (!videoId) {
        throw new Error('Invalid TikTok URL');
      }

      // Use TikTok API to get video info
      const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
      const { data } = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet'
        }
      });

      const videoUrl = data.aweme_list[0]?.video?.play_addr?.url_list[0];
      if (!videoUrl) {
        throw new Error('Video not found');
      }

      const fileName = `tiktok_${videoId}.mp4`;
      const filePath = path.join(DOWNLOAD_PATH, fileName);

      const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet'
        }
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`TikTok download failed: ${error.message}`);
    }
  }

  async downloadFromFacebook(url) {
    try {
      // Extract video ID from URL
      const videoId = url.match(/facebook\.com\/.*\/videos\/([0-9]+)/)?.[1];
      if (!videoId) {
        throw new Error('Invalid Facebook URL');
      }

      // Use Facebook Graph API to get video info
      const graphApiUrl = `https://graph.facebook.com/v12.0/${videoId}?fields=source&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
      const { data } = await axios.get(graphApiUrl);

      if (!data.source) {
        throw new Error('Video source not found');
      }

      const fileName = `facebook_${videoId}.mp4`;
      const filePath = path.join(DOWNLOAD_PATH, fileName);

      const response = await axios({
        method: 'get',
        url: data.source,
        responseType: 'stream'
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Facebook download failed: ${error.message}`);
    }
  }

  async downloadFromDailymotion(url) {
    try {
      // Extract video ID from URL with improved regex
      const videoId = url.match(/(?:dailymotion\.com(?:\/video|\/embed\/video|\/embed|\/hub\/[^/]+\/video)?\/)([a-zA-Z0-9]+)(?:_[^?]*)?/)?.[1];
      if (!videoId) {
        throw new Error('Invalid Dailymotion URL');
      }
    
      // Get authentication token with retry mechanism
      const platformAuth = require('./platform_auth');
      let auth;
      try {
        auth = await platformAuth.authenticate('dailymotion');
      } catch (authError) {
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      const { accessToken } = auth;
    
      // Get video metadata using Dailymotion API with enhanced error handling
      const apiUrl = `https://api.dailymotion.com/video/${videoId}`;
      const { data } = await axios.get(apiUrl, {
        params: {
          fields: 'stream_h264_url,stream_h264_hd_url,stream_h264_hq_url,stream_h264_ld_url,private,password_protected,title',
          family_filter: 0
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000,
        validateStatus: (status) => status === 200
      });
    
      // Check video accessibility
      if (data.private) {
        throw new Error('This video is private and cannot be accessed');
      }
    
      if (data.password_protected) {
        throw new Error('This video is password protected');
      }
    
      // Get the best available quality stream URL with fallback options
      let streamUrl;
      try {
        // Try to get the direct stream URL first
        const streamResponse = await axios.get(`https://www.dailymotion.com/player/metadata/video/${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
    
        const qualities = streamResponse.data.qualities;
        streamUrl = qualities?.auto?.[0]?.url || qualities?.['1080']?.[0]?.url || qualities?.['720']?.[0]?.url || qualities?.['480']?.[0]?.url;
      } catch (streamError) {
        // Fallback to standard API stream URLs if player metadata fails
        streamUrl = data.stream_h264_hd_url || data.stream_h264_hq_url || data.stream_h264_url || data.stream_h264_ld_url;
      }
    
      if (!streamUrl) {
        throw new Error('Video stream not available. The video might be private, restricted, or requires authentication.');
      }
    
      // Download the video with proper headers and timeout
      const fileName = `dailymotion_${videoId}.mp4`;
      const filePath = path.join(DOWNLOAD_PATH, fileName);
    
      const response = await axios({
        method: 'get',
        url: streamUrl,
        responseType: 'stream',
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.dailymotion.com/'
        },
        validateStatus: (status) => status === 200
      });
    
      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
    
        let error = null;
        writer.on('error', err => {
          error = err;
          writer.close();
          reject(new Error(`Failed to write video file: ${err.message}`));
        });
    
        writer.on('close', () => {
          if (!error) {
            resolve(filePath);
          }
        });
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 400) {
          throw new Error('Invalid request. Please check the video ID and try again.');
        } else if (status === 401 || status === 403) {
          throw new Error('Access denied. Please check your authentication credentials.');
        } else if (status === 404) {
          throw new Error('Video not found. It might have been removed or made private.');
        } else if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
      }
      throw new Error(`Dailymotion download failed: ${error.message}`);
    }
  }

  async downloadFromInstagram(url) {
    try {
      // Enhanced URL pattern matching to support more Instagram URL formats
      const shortcode = url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv|stories)\/([\w-]+)(?:\/[\w-]+)?/)?.[1];
      if (!shortcode) {
        throw new Error('Invalid Instagram URL. Please provide a valid Instagram video URL (e.g., https://www.instagram.com/p/POST_ID, /reel/REEL_ID, or /tv/TV_ID)');
      }

      // Use Instagram Graph API with enhanced error handling and rate limiting
      const graphApiUrl = `https://graph.instagram.com/v12.0/${shortcode}?fields=media_url,media_type,thumbnail_url&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`;
      const { data } = await axios.get(graphApiUrl, {
        timeout: 10000,
        retry: 3,
        retryDelay: 1000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Instagram-Graph-API-Client'
        }
      });

      if (!data.media_url) {
        throw new Error('Media URL not found in the API response');
      }

      if (data.media_type !== 'VIDEO') {
        throw new Error('The provided URL does not point to a video content');
      }

      const fileName = `instagram_${shortcode}_${Date.now()}.mp4`;
      const filePath = path.join(DOWNLOAD_PATH, fileName);

      const response = await axios({
        method: 'get',
        url: data.media_url,
        responseType: 'stream',
        timeout: 30000,
        maxContentLength: MAX_FILE_SIZE,
        validateStatus: status => status === 200
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        let error = null;
        writer.on('error', err => {
          error = err;
          writer.close();
          reject(new Error(`Failed to write video file: ${err.message}`));
        });

        writer.on('close', () => {
          if (!error) {
            resolve(filePath);
          }
        });
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 429) {
          throw new Error('Instagram API rate limit exceeded. Please try again later.');
        } else if (status === 401) {
          throw new Error('Instagram API authentication failed. Please check your access token.');
        }
      }
      throw new Error(`Instagram download failed: ${error.message}`);
    }
  }

  async validateFileSize(filePath) {
    const stats = await fs.promises.stat(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds maximum allowed size');
    }
    return true;
  }
}

module.exports = new Downloader();