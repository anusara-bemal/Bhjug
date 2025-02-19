const EventEmitter = require('events');

class ProgressTracker extends EventEmitter {
  constructor() {
    super();
    this.progress = 0;
    this.total = 0;
    this.startTime = null;
  }

  start(total) {
    this.progress = 0;
    this.total = total;
    this.startTime = Date.now();
    this.emit('start', { total });
  }

  update(current) {
    this.progress = current;
    const percentage = (current / this.total) * 100;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = current / elapsed;
    const remaining = (this.total - current) / speed;

    this.emit('progress', {
      current,
      total: this.total,
      percentage: Math.round(percentage * 100) / 100,
      speed: Math.round(speed),
      elapsed: Math.round(elapsed),
      remaining: Math.round(remaining)
    });
  }

  finish() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.emit('finish', {
      total: this.total,
      elapsed: Math.round(elapsed)
    });
  }

  error(error) {
    this.emit('error', error);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  formatProgress(data) {
    const { current, total, percentage, speed, elapsed, remaining } = data;
    return [
      `Progress: ${percentage}%`,
      `${this.formatBytes(current)} / ${this.formatBytes(total)}`,
      `Speed: ${this.formatBytes(speed)}/s`,
      `Time: ${this.formatTime(elapsed)} / ${this.formatTime(remaining)}`
    ].join(' | ');
  }
}

module.exports = ProgressTracker;