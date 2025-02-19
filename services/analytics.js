const winston = require('winston');
const fs = require('fs');
const path = require('path');

class Analytics {
  constructor() {
    this.dataPath = path.join('data', 'analytics');
    this.ensureDataDirectory();
    this.initializeLogger();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  initializeLogger() {
    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(this.dataPath, 'analytics.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        new winston.transports.File({
          filename: path.join(this.dataPath, 'error.log'),
          level: 'error',
          maxsize: 5242880,
          maxFiles: 5
        })
      ]
    });
  }

  async logDownload(userId, platform, url, success, error = null) {
    const data = {
      userId,
      platform,
      url,
      success,
      error: error?.message || error,
      timestamp: new Date().toISOString(),
      type: 'download'
    };

    this.logger.info('download_attempt', data);
    await this.updateStats('downloads', platform, success);
    await this.updateUserStats(userId, 'downloads', success);
  }

  async logUpload(userId, platform, fileId, success, error = null) {
    const data = {
      userId,
      platform,
      fileId,
      success,
      error: error?.message || error,
      timestamp: new Date().toISOString(),
      type: 'upload'
    };

    this.logger.info('upload_attempt', data);
    await this.updateStats('uploads', platform, success);
    await this.updateUserStats(userId, 'uploads', success);
  }

  async updateStats(type, platform, success) {
    const statsFile = path.join(this.dataPath, 'stats.json');
    let stats = {};

    try {
      if (fs.existsSync(statsFile)) {
        stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      }

      stats[type] = stats[type] || {};
      stats[type][platform] = stats[type][platform] || { 
        success: 0, 
        failed: 0,
        total: 0,
        lastUpdated: null
      };
      
      if (success) {
        stats[type][platform].success++;
      } else {
        stats[type][platform].failed++;
      }
      stats[type][platform].total++;
      stats[type][platform].lastUpdated = new Date().toISOString();

      await fs.promises.writeFile(statsFile, JSON.stringify(stats, null, 2));
    } catch (error) {
      this.logger.error('Failed to update stats', { error: error.message, type, platform });
    }
  }

  async updateUserStats(userId, type, success) {
    const userStatsFile = path.join(this.dataPath, 'user_stats.json');
    let userStats = {};

    try {
      if (fs.existsSync(userStatsFile)) {
        userStats = JSON.parse(fs.readFileSync(userStatsFile, 'utf8'));
      }

      userStats[userId] = userStats[userId] || {};
      userStats[userId][type] = userStats[userId][type] || {
        success: 0,
        failed: 0,
        total: 0,
        lastActivity: null
      };

      if (success) {
        userStats[userId][type].success++;
      } else {
        userStats[userId][type].failed++;
      }
      userStats[userId][type].total++;
      userStats[userId][type].lastActivity = new Date().toISOString();

      await fs.promises.writeFile(userStatsFile, JSON.stringify(userStats, null, 2));
    } catch (error) {
      this.logger.error('Failed to update user stats', { error: error.message, userId, type });
    }
  }

  async getStats() {
    const statsFile = path.join(this.dataPath, 'stats.json');
    try {
      if (fs.existsSync(statsFile)) {
        return JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      }
      return {};
    } catch (error) {
      this.logger.error('Failed to read stats', { error: error.message });
      return {};
    }
  }

  async getUserStats(userId) {
    const userStatsFile = path.join(this.dataPath, 'user_stats.json');
    try {
      if (fs.existsSync(userStatsFile)) {
        const userStats = JSON.parse(fs.readFileSync(userStatsFile, 'utf8'));
        return userStats[userId] || {};
      }
      return {};
    } catch (error) {
      this.logger.error('Failed to read user stats', { error: error.message, userId });
      return {};
    }
  }

  async logState(userId, type, state, details = {}) {
    const data = {
      userId,
      type,
      state,
      details,
      timestamp: new Date().toISOString()
    };

    this.logger.info('state_change', data);
  }

  async logNotification(userId, type, message, level = 'info') {
    const data = {
      userId,
      type,
      message,
      level,
      timestamp: new Date().toISOString()
    };

    this.logger[level]('notification', data);
  }

  async logVideoProcessing(userId, videoId, action, status, details = {}) {
    const data = {
      userId,
      videoId,
      action,
      status,
      details,
      timestamp: new Date().toISOString()
    };

    this.logger.info('video_processing', data);
  }

  async getProcessingHistory(userId, limit = 50) {
    // Implementation for retrieving processing history
    // This would typically involve reading and parsing the log file
    // For now, we'll return a placeholder
    return [];
  }

}

module.exports = new Analytics();