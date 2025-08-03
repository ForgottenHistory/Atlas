const logger = require('../logger/Logger');

class ImageExtractor {
  extractImagesFromMessage(message) {
    const images = [];

    // Extract from attachments
    if (message.attachments && message.attachments.size > 0) {
      message.attachments.forEach(attachment => {
        if (this.isImageAttachment(attachment)) {
          images.push({
            url: attachment.url,
            filename: attachment.name,
            size: attachment.size,
            source: 'attachment'
          });
        }
      });
    }

    // Extract from embeds (images shared via links)
    if (message.embeds && message.embeds.length > 0) {
      message.embeds.forEach(embed => {
        if (embed.image && embed.image.url) {
          images.push({
            url: embed.image.url,
            filename: 'embedded_image',
            source: 'embed'
          });
        }
        if (embed.thumbnail && embed.thumbnail.url) {
          images.push({
            url: embed.thumbnail.url,
            filename: 'thumbnail',
            source: 'thumbnail'
          });
        }
      });
    }

    logger.debug('Extracted images from Discord message', {
      source: 'imageProcessing',
      imageCount: images.length,
      sources: images.map(img => img.source)
    });

    return images;
  }

  isImageAttachment(attachment) {
    if (!attachment.contentType) {
      // Fallback to filename extension
      const ext = attachment.name?.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    }

    return attachment.contentType.startsWith('image/');
  }

  validateImageSize(buffer, maxSizeMB = 20) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error(`Image size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`);
    }
    return true;
  }
}

module.exports = ImageExtractor;