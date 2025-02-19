require('dotenv').config();

// Bot Configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is not set');
}

// Channel IDs
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const DOWNLOAD_CHANNEL_ID = process.env.DOWNLOAD_CHANNEL_ID;

if (!LOG_CHANNEL_ID || !DOWNLOAD_CHANNEL_ID) {
  throw new Error('LOG_CHANNEL_ID and DOWNLOAD_CHANNEL_ID must be set');
}

// Supported Platforms
const SUPPORTED_PLATFORMS = ['youtube', 'tiktok', 'facebook', 'dailymotion', 'instagram'];

// Download Configuration
const DOWNLOAD_PATH = 'downloads/';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB - Telegram Bot API limit

// Video Enhancement Settings
const VIDEO_ENHANCEMENT = {
  max_resolution: '1080p',
  default_quality: 'high',
  supported_formats: ['mp4', 'webm'],
  max_duration: 10 * 60 // 10 minutes
};

// Playlist Settings
const PLAYLIST_SETTINGS = {
  max_playlists_per_user: 10,
  max_videos_per_playlist: 100,
  supported_privacy_options: ['public', 'private']
};

// Message Templates
const WELCOME_MESSAGE = `
Video Download Bot වෙත සාදරයෙන් පිළිගනිමු! 🎥

පහත platform වලින් ඕනෑම එකකින් වීඩියෝ බාගත කරන්න:
- YouTube 📺
- TikTok 🎵
- Facebook 👥
- Dailymotion 🎬
- Instagram 📷

ලබා ගත හැකි විධාන:
/start - මෙම පණිවිඩය පෙන්වන්න
/help - උපකාර තොරතුරු පෙන්වන්න
/platforms - Platform විස්තර සහ playlists බලන්න
`;

const HELP_MESSAGE = `
Bot භාවිතා කරන ආකාරය:

1. සහාය දක්වන platform වලින් වීඩියෝ link එකක් එවන්න
2. Download quality එක තෝරන්න
3. Enhancement options තෝරන්න
4. Download සහ upload වන තුරු රැඳී සිටින්න

සහාය දක්වන platforms:
- YouTube
- TikTok
- Facebook
- Dailymotion
- Instagram

විශේෂාංග:
- වීඩියෝ තත්ත්ව වැඩිදියුණු කිරීම
- Custom captions
- Watermarking
- වීඩියෝ කැපීම
- Thumbnail තේරීම
- Playlist කළමනාකරණය
- Platform විස්තර බැලීම

ගැටළු සඳහා, @admin අමතන්න
`;

module.exports = {
  BOT_TOKEN,
  LOG_CHANNEL_ID,
  DOWNLOAD_CHANNEL_ID,
  SUPPORTED_PLATFORMS,
  DOWNLOAD_PATH,
  MAX_FILE_SIZE,
  VIDEO_ENHANCEMENT,
  PLAYLIST_SETTINGS,
  WELCOME_MESSAGE,
  HELP_MESSAGE
};