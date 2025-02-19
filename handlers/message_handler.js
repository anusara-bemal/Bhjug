const { SUPPORTED_PLATFORMS } = require('../config');
const downloader = require('../services/downloader');
const videoProcessor = require('../services/video_processor');
const analytics = require('../services/analytics');
const uploader = require('../services/uploader');

async function handleMessage(msg, bot) {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  // Check if the message is a URL
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})[/\w .-]*\/?$/;
  if (!urlPattern.test(messageText)) {
    await bot.sendMessage(chatId, 'Please send a valid URL from a supported platform.');
    return;
  }

  // Check if the URL is from a supported platform
  const platform = SUPPORTED_PLATFORMS.find(p => messageText.includes(p));
  if (!platform) {
    await bot.sendMessage(chatId, 'This platform is not supported. Please use one of the supported platforms.');
    return;
  }

  try {
    // Send processing message
    const processingMsg = await bot.sendMessage(chatId, 'Processing your request...');

    // Show quality selection options
    const qualityOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '720p', callback_data: `quality_720p_${messageText}` },
            { text: '1080p', callback_data: `quality_1080p_${messageText}` }
          ],
          [{ text: 'Best Available', callback_data: `quality_best_${messageText}` }]
        ]
      }
    };

    await bot.editMessageText('Select video quality:', {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      ...qualityOptions
    });

    // Note: The actual download and processing will be handled by the callback handler
    // when the user selects a quality option

  } catch (error) {
    await bot.sendMessage(chatId, `Error: ${error.message}`);
    
    // Log failed attempt
    await analytics.logDownload({
      userId: msg.from.id,
      platform,
      url: messageText,
      success: false,
      error: error.message
    });
  }
}

module.exports = { handleMessage };