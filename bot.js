require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { startCommand, helpCommand, platformsCommand } = require('./handlers/command_handler');
const { handleCallback } = require('./handlers/callback_handler');
const { handleMessage } = require('./handlers/message_handler');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Environment variables validation
const BOT_TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const DOWNLOAD_CHANNEL_ID = process.env.DOWNLOAD_CHANNEL_ID;

if (!BOT_TOKEN || !LOG_CHANNEL_ID || !DOWNLOAD_CHANNEL_ID) {
  throw new Error('Missing required environment variables');
}

// Create required directories
const requiredDirs = ['downloads', 'data/analytics'];
requiredDirs.forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
  logger.info(`Created directory: ${dir}`);
});

// File-based locking mechanism
const lockFile = path.join(__dirname, 'bot.lock');

if (fs.existsSync(lockFile)) {
  logger.error('Another bot instance is already running');
  process.exit(1);
}

// Create lock file
fs.writeFileSync(lockFile, process.pid.toString());

// Remove lock file on process exit
process.on('exit', () => {
  try {
    fs.unlinkSync(lockFile);
  } catch (error) {
    logger.error('Error removing lock file:', error);
  }
});

// Handle SIGINT and SIGTERM
process.on('SIGINT', () => {
  try {
    fs.unlinkSync(lockFile);
  } catch (error) {
    logger.error('Error removing lock file:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  try {
    fs.unlinkSync(lockFile);
  } catch (error) {
    logger.error('Error removing lock file:', error);
  }
  process.exit(0);
});

// Initialize bot and make it globally available
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
global.bot = bot;

// Error handler
const handleError = async (error, ctx) => {
  let errorMessage = 'An unexpected error occurred. Please try again later.';

  if (error.code === 'ETELEGRAM') {
    errorMessage = 'Telegram service error. Please try again later.';
  } else if (error.code === 'ETIMEDOUT') {
    errorMessage = 'Request timed out. Please try again.';
  }

  logger.error('Bot error:', error);

  try {
    // Log to channel
    if (LOG_CHANNEL_ID) {
      await bot.sendMessage(LOG_CHANNEL_ID, 
        `❌ Error Details:\nError Type: ${error.name}\n` +
        `Error Message: ${error.message}\n` +
        `User: ${ctx?.from?.username || 'Unknown'}\n` +
        `Chat: ${ctx?.chat?.id || 'Unknown'}`
      );
    }

    // Notify user
    if (ctx?.chat?.id) {
      await bot.sendMessage(ctx.chat.id, errorMessage);
    }
  } catch (e) {
    logger.error('Error in error handler:', e);
  }
};

// Register command handlers
bot.onText(/\/start/, startCommand);
bot.onText(/\/help/, helpCommand);
bot.onText(/\/platforms/, platformsCommand);

// Register callback query handler
bot.on('callback_query', handleCallback);

// Register message handler for non-command messages
bot.on('message', (msg) => {
  if (!msg.text?.startsWith('/')) {
    handleMessage(msg, bot);
  }
});

// Register error handler
bot.on('polling_error', (error) => handleError(error));
bot.on('error', (error) => handleError(error));

logger.info('Bot started successfully');