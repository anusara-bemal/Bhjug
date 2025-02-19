const { DOWNLOAD_CHANNEL_ID } = require('../config');
const downloader = require('../services/downloader');
const videoProcessor = require('../services/video_processor');
const uploader = require('../services/uploader');

async function handleCallback(callbackQuery) {
  const bot = global.bot;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  try {

    if (data.startsWith('quality_')) {
      const [quality, url] = data.replace('quality_', '').split('_');
      let statusMsg = callbackQuery.message;
      
      // Only update message if content is different
      if (statusMsg.text !== 'Downloading video...') {
        statusMsg = await bot.editMessageText('Downloading video...', {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        });
      }

      // Detect platform from URL
      let platform = 'youtube';
      if (url.includes('facebook.com') || url.includes('fb.watch')) {
        platform = 'facebook';
      } else if (url.includes('instagram.com')) {
        platform = 'instagram';
      } else if (url.includes('tiktok.com')) {
        platform = 'tiktok';
      } else if (url.includes('dailymotion.com')) {
        platform = 'dailymotion';
      }

      // Download the video
      const downloadedPath = await downloader.download(url, platform, callbackQuery.from.id);
      await bot.editMessageText('Download complete! Choose editing options:', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✏️ Add Caption', callback_data: `edit_caption_${downloadedPath}` },
              { text: '✂️ Trim Video', callback_data: `edit_trim_${downloadedPath}` }
            ],
            [
              { text: '🔍 Blur Face', callback_data: `edit_blur_face_${downloadedPath}` },
              { text: '⚠️ Blur Sensitive Content', callback_data: `edit_blur_sensitive_${downloadedPath}` }
            ],
            [
              { text: '📝 Add Subtitles', callback_data: `edit_subtitle_${downloadedPath}` },
              { text: '✨ Enhance Quality', callback_data: `edit_enhance_${downloadedPath}` }
            ],
            [{ text: '✅ Proceed to Upload', callback_data: `upload_${downloadedPath}` }]
          ]
        }
      });
    } else if (data.startsWith('edit_')) {
      // Handle different editing options
      const [action, ...params] = data.split('_');
      const filePath = params.join('_');

      switch(action) {
        case 'caption':
          // Implement caption addition logic
          break;
        case 'trim':
          // Implement video trimming logic
          break;
        case 'blur_face':
          // Implement face blurring logic
          break;
        case 'blur_sensitive':
          // Implement sensitive content blurring logic
          break;
        case 'subtitle':
          // Show subtitle options (hard/soft)
          await bot.editMessageText('Choose subtitle type:', {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Hard Subtitles', callback_data: `subtitle_hard_${filePath}` },
                  { text: 'Soft Subtitles', callback_data: `subtitle_soft_${filePath}` }
                ],
                [{ text: '⬅️ Back', callback_data: `back_to_edit_${filePath}` }]
              ]
            }
          });
          break;
        case 'enhance':
          // Implement AI-based enhancement logic
          break;
      }
    } else if (data.startsWith('upload_')) {
      const filePath = data.replace('upload_', '');
      // Show platform selection for upload
      await bot.editMessageText('Select platforms to upload:', {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'YouTube', callback_data: `platform_youtube_${filePath}` },
              { text: 'Facebook', callback_data: `platform_facebook_${filePath}` }
            ],
            [
              { text: 'Instagram', callback_data: `platform_instagram_${filePath}` },
              { text: 'TikTok', callback_data: `platform_tiktok_${filePath}` }
            ],
            [
              { text: 'Dailymotion', callback_data: `platform_dailymotion_${filePath}` }
            ],
            [{ text: '✅ Start Upload', callback_data: `start_upload_${filePath}` }]
          ]
        }
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    } else if (data.startsWith('platform_')) {
      const [platform, filePath] = data.replace('platform_', '').split('_');
      // Toggle platform selection
      const selectedPlatforms = global.selectedPlatforms || new Map();
      const fileSelections = selectedPlatforms.get(filePath) || new Set();
      
      if (fileSelections.has(platform)) {
        fileSelections.delete(platform);
      } else {
        fileSelections.add(platform);
      }
      
      selectedPlatforms.set(filePath, fileSelections);
      global.selectedPlatforms = selectedPlatforms;

      // Update message with selected platforms
      const platforms = ['youtube', 'facebook', 'instagram', 'tiktok', 'dailymotion'];
      const keyboard = platforms.reduce((acc, p) => {
        if (acc[acc.length - 1].length === 2) {
          acc.push([]);
        }
        const isSelected = fileSelections.has(p);
        acc[acc.length - 1].push({
          text: `${isSelected ? '✅' : ''} ${p.charAt(0).toUpperCase() + p.slice(1)}`,
          callback_data: `platform_${p}_${filePath}`
        });
        return acc;
      }, [[]]);

      keyboard.push([{ text: '✅ Start Upload', callback_data: `start_upload_${filePath}` }]);

      await bot.editMessageReplyMarkup({
        inline_keyboard: keyboard
      }, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } else if (data.startsWith('start_upload_')) {
      const filePath = data.replace('start_upload_', '');
      const selectedPlatforms = global.selectedPlatforms?.get(filePath);

      if (!selectedPlatforms || selectedPlatforms.size === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Please select at least one platform to upload',
          show_alert: true
        });
        return;
      }

      await bot.editMessageText('Starting upload...', {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });

      try {
        const results = [];
        for (const platform of selectedPlatforms) {
          try {
            const result = await uploader.upload(filePath, platform);
            results.push(`✅ ${platform}: ${result.url}`);
          } catch (error) {
            results.push(`❌ ${platform}: ${error.message}`);
          }
        }

        await bot.editMessageText(`Upload Results:\n${results.join('\n')}`, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        });

        // Clear selections after upload
        global.selectedPlatforms?.delete(filePath);
      } catch (error) {
        await bot.editMessageText(`Upload failed: ${error.message}`, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        });
      }

      await bot.answerCallbackQuery(callbackQuery.id);

    }
  } catch (error) {
    console.error('Callback error:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'An error occurred' });
    await bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

module.exports = { handleCallback };