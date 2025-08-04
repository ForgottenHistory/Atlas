const logger = require('../../logger/Logger');

class EmbedExtractor {
  constructor() {
    // Define which embed types we want to process
    this.supportedTypes = ['rich', 'link', 'article', 'video'];
  }

  /**
   * Check if message has processable embeds
   * @param {Object} message - Discord message object
   * @returns {boolean}
   */
  hasEmbeds(message) {
    return message.embeds && message.embeds.length > 0;
  }

  /**
   * Extract structured data from all embeds in a message
   * @param {Object} message - Discord message object
   * @returns {Array} - Array of embed data objects
   */
  extractEmbedsFromMessage(message) {
    if (!this.hasEmbeds(message)) {
      return [];
    }

    const embeds = [];

    message.embeds.forEach((embed, index) => {
      const embedData = this.extractSingleEmbed(embed, index);
      if (embedData.hasContent) {
        embeds.push(embedData);
      }
    });

    logger.debug('Extracted embed data from message', {
      source: 'discord',
      messageId: message.id,
      totalEmbeds: message.embeds.length,
      processableEmbeds: embeds.length,
      embedTypes: embeds.map(e => e.type)
    });

    return embeds;
  }

  /**
   * Extract data from a single embed
   * @param {Object} embed - Discord embed object
   * @param {number} index - Embed index in message
   * @returns {Object} - Structured embed data
   */
  extractSingleEmbed(embed, index = 0) {
    const embedData = {
      index: index,
      type: embed.type || 'unknown',
      hasContent: false,
      metadata: {
        title: embed.title || null,
        description: embed.description || null,
        url: embed.url || null,
        timestamp: embed.timestamp || null,
        color: embed.color || null
      },
      author: this.extractAuthor(embed.author),
      fields: this.extractFields(embed.fields),
      footer: this.extractFooter(embed.footer),
      media: this.extractMedia(embed)
    };

    // Determine if this embed has meaningful content
    embedData.hasContent = this.hasmeaningfulContent(embedData);

    return embedData;
  }

  /**
   * Extract author information
   * @param {Object} author - Embed author object
   * @returns {Object|null}
   */
  extractAuthor(author) {
    if (!author) return null;

    return {
      name: author.name || null,
      url: author.url || null,
      iconURL: author.iconURL || null
    };
  }

  /**
   * Extract embed fields
   * @param {Array} fields - Embed fields array
   * @returns {Array}
   */
  extractFields(fields) {
    if (!fields || !Array.isArray(fields)) return [];

    return fields.map(field => ({
      name: field.name || '',
      value: field.value || '',
      inline: field.inline || false
    })).filter(field => field.name && field.value);
  }

  /**
   * Extract footer information
   * @param {Object} footer - Embed footer object
   * @returns {Object|null}
   */
  extractFooter(footer) {
    if (!footer) return null;

    return {
      text: footer.text || null,
      iconURL: footer.iconURL || null
    };
  }

  /**
   * Extract media information (images, videos, thumbnails)
   * @param {Object} embed - Full embed object
   * @returns {Object}
   */
  extractMedia(embed) {
    return {
      image: embed.image ? {
        url: embed.image.url,
        width: embed.image.width,
        height: embed.image.height
      } : null,
      thumbnail: embed.thumbnail ? {
        url: embed.thumbnail.url,
        width: embed.thumbnail.width,
        height: embed.thumbnail.height
      } : null,
      video: embed.video ? {
        url: embed.video.url,
        width: embed.video.width,
        height: embed.video.height
      } : null
    };
  }

  /**
   * Determine if embed has meaningful content for AI processing
   * @param {Object} embedData - Processed embed data
   * @returns {boolean}
   */
  hasmeaningfulContent(embedData) {
    // Has text content
    if (embedData.metadata.title || embedData.metadata.description) {
      return true;
    }

    // Has author info
    if (embedData.author && embedData.author.name) {
      return true;
    }

    // Has fields with content
    if (embedData.fields && embedData.fields.length > 0) {
      return true;
    }

    // Has footer text
    if (embedData.footer && embedData.footer.text) {
      return true;
    }

    // Has URL (link embeds)
    if (embedData.metadata.url) {
      return true;
    }

    return false;
  }

  /**
   * Get summary statistics about extracted embeds
   * @param {Array} embeds - Array of embed data
   * @returns {Object}
   */
  getEmbedStats(embeds) {
    return {
      total: embeds.length,
      types: [...new Set(embeds.map(e => e.type))],
      hasText: embeds.some(e => e.metadata.title || e.metadata.description),
      hasFields: embeds.some(e => e.fields.length > 0),
      hasMedia: embeds.some(e => e.media.image || e.media.video || e.media.thumbnail),
      hasLinks: embeds.some(e => e.metadata.url)
    };
  }
}

module.exports = EmbedExtractor;