const { WELCOME_MESSAGE, HELP_MESSAGE } = require('../config');
const { isValidUrl, getPlatform } = require('../utils/validators');
const { downloadVideo } = require('../services/downloader');
const logger = require('winston');

const startCommand = async (msg) => {
  try {
    const user = msg.from;
    const bot = global.bot;

    // Try to log to channel
    try {
      await bot.sendMessage(
        process.env.LOG_CHANNEL_ID,
        `👤 New user started bot: ${user.username || user.id}`
      );
    } catch (e) {
      logger.warn(`Could not send log message: ${e.message}`);
    }

    await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE);
  } catch (e) {
    logger.error(`Error in start command: ${e.message}`);
    await bot.sendMessage(msg.chat.id, "දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.");
  }
};

const helpCommand = async (msg) => {
  try {
    const user = msg.from;
    const bot = global.bot;

    // Try to log to channel
    try {
      await bot.sendMessage(
        process.env.LOG_CHANNEL_ID,
        `ℹ️ Help command used by: ${user.username || user.id}`
      );
    } catch (e) {
      logger.warn(`Could not send log message: ${e.message}`);
    }

    await bot.sendMessage(msg.chat.id, HELP_MESSAGE);
  } catch (e) {
    logger.error(`Error in help command: ${e.message}`);
    await bot.sendMessage(msg.chat.id, "දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.");
  }
};

const platformsCommand = async (msg) => {
  try {
    const keyboard = {
      inline_keyboard: [
        [
          { text: "YouTube දත්ත 📊", callback_data: "platform_stats_youtube" },
          { text: "TikTok දත්ත 📊", callback_data: "platform_stats_tiktok" }
        ],
        [
          { text: "Instagram දත්ත 📊", callback_data: "platform_stats_instagram" },
          { text: "Facebook දත්ත 📊", callback_data: "platform_stats_facebook" }
        ],
        [{ text: "Dailymotion දත්ත 📊", callback_data: "platform_stats_dailymotion" }],
        [{ text: "Playlist කළමනාකරණය 📂", callback_data: "manage_playlists" }],
        [{ text: "ලේඛන බලන්න 📄", callback_data: "view_documents" }]
      ]
    };

    await bot.sendMessage(
      msg.chat.id,
      "පහත ඕනෑම platform එකක විස්තර බැලීමට හෝ playlist කළමනාකරණය සඳහා තෝරන්න:",
      { reply_markup: keyboard }
    );
  } catch (e) {
    logger.error(`Error in platforms command: ${e.message}`);
    await bot.sendMessage(msg.chat.id, "දෝෂයක් ඇති විය. නැවත උත්සාහ කරන්න.");
  }
};

const handleMessage = async (msg, bot) => {
  const url = msg.text.trim();
  const user = msg.from;

  try {
    // Log URL receipt
    try {
      await bot.sendMessage(
        process.env.LOG_CHANNEL_ID,
        `🔗 URL received from ${user.username || user.id}:\n${url}`
      );
    } catch (e) {
      logger.warn(`Could not send log message: ${e.message}`);
    }

    // Validate URL
    if (!isValidUrl(url)) {
      await bot.sendMessage(
        msg.chat.id,
        "❌ දී ඇති URL එක වලංගු නැත.\n" +
        "කරුණාකර වලංගු video URL එකක් යවන්න.\n\n" +
        "සහාය දක්වන platforms:\n" +
        "• YouTube\n" +
        "• Facebook\n" +
        "• Instagram\n" +
        "• TikTok\n" +
        "• Dailymotion"
      );
      return;
    }

    // Create platform selection keyboard
    const keyboard = {
      inline_keyboard: [
        [
          { text: "YouTube ▢", callback_data: "platform_youtube" },
          { text: "TikTok ▢", callback_data: "platform_tiktok" }
        ],
        [
          { text: "Instagram ▢", callback_data: "platform_instagram" },
          { text: "Facebook ▢", callback_data: "platform_facebook" }
        ],
        [{ text: "Dailymotion ▢", callback_data: "platform_dailymotion" }],
        [{ text: "ඉදිරියට යන්න ➜", callback_data: "platforms_selected" }],
        [{ text: "Caption එකක් එකතු කරන්න 📝", callback_data: "add_caption" }],
        [{ text: "Playlist තෝරන්න 📂", callback_data: "select_playlist" }]
      ]
    };

    // Store URL in context
    global.userContexts = global.userContexts || {};
    global.userContexts[msg.chat.id] = {
      currentUrl: url,
      selectedPlatforms: new Set()
    };

    // Show platform selection message
    await bot.sendMessage(
      msg.chat.id,
      "✅ URL එක ලැබී ඇත!\n\n" +
      "Upload කිරීමට platform තෝරන්න:\n" +
      "(ඔබට platforms කිහිපයක් තෝරාගත හැක)",
      { reply_markup: keyboard }
    );

  } catch (e) {
    logger.error(`Error processing URL: ${e.message}`, e);
    await bot.sendMessage(
      msg.chat.id,
      "දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න."
    );
  }
};

module.exports = {
  startCommand,
  helpCommand,
  platformsCommand,
  handleMessage
};