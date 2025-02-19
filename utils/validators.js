const { SUPPORTED_PLATFORMS } = require('../config');

class Validators {
  static validateUrl(url, platform) {
    if (!url) {
      throw new Error('URL is required');
    }

    if (!platform) {
      throw new Error('Platform is required');
    }

    if (!SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const urlPatterns = {
      youtube: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i,
      tiktok: /^(https?:\/\/)?(www\.|vm\.)?tiktok\.com\/.+/i,
      facebook: /^(https?:\/\/)?(www\.|m\.)?facebook\.com\/.+/i,
      dailymotion: /^(https?:\/\/)?(www\.)?dailymotion\.com\/.+/i,
      instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/.+/i
    };

    if (!urlPatterns[platform].test(url)) {
      throw new Error(`Invalid ${platform} URL format`);
    }

    return true;
  }

  static validateMetadata(metadata, platform) {
    if (!metadata) {
      return {};
    }

    const validatedMetadata = {};

    switch (platform) {
      case 'youtube':
        validatedMetadata.title = this.validateTitle(metadata.title);
        validatedMetadata.description = this.validateDescription(metadata.description);
        validatedMetadata.tags = this.validateTags(metadata.tags);
        validatedMetadata.privacy = this.validatePrivacy(metadata.privacy);
        break;

      case 'facebook':
        validatedMetadata.title = this.validateTitle(metadata.title);
        validatedMetadata.description = this.validateDescription(metadata.description);
        break;

      case 'instagram':
        validatedMetadata.caption = this.validateCaption(metadata.caption);
        break;

      default:
        throw new Error(`Metadata validation not implemented for ${platform}`);
    }

    return validatedMetadata;
  }

  static validateTitle(title) {
    if (!title) return '';
    if (typeof title !== 'string') {
      throw new Error('Title must be a string');
    }
    if (title.length > 100) {
      throw new Error('Title must not exceed 100 characters');
    }
    return title.trim();
  }

  static validateDescription(description) {
    if (!description) return '';
    if (typeof description !== 'string') {
      throw new Error('Description must be a string');
    }
    if (description.length > 5000) {
      throw new Error('Description must not exceed 5000 characters');
    }
    return description.trim();
  }

  static validateTags(tags) {
    if (!tags) return [];
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }
    return tags
      .filter(tag => typeof tag === 'string' && tag.trim())
      .map(tag => tag.trim())
      .slice(0, 500); // YouTube allows up to 500 tags
  }

  static validatePrivacy(privacy) {
    const validPrivacySettings = ['private', 'public', 'unlisted'];
    if (!privacy) return 'private';
    if (!validPrivacySettings.includes(privacy)) {
      throw new Error('Invalid privacy setting');
    }
    return privacy;
  }

  static validateCaption(caption) {
    if (!caption) return '';
    if (typeof caption !== 'string') {
      throw new Error('Caption must be a string');
    }
    if (caption.length > 2200) { // Instagram's caption limit
      throw new Error('Caption must not exceed 2200 characters');
    }
    return caption.trim();
  }
}

module.exports = Validators;