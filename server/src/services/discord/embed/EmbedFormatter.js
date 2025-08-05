class EmbedFormatter {
  constructor() {
    // Configuration for text formatting - increased limits for better context
    this.maxDescriptionLength = 800;  // Increased from 200
    this.maxFieldLength = 400;        // Increased from 150  
    this.maxTitleLength = 200;        // Increased from 100
  }

  /**
   * Format embed data as readable text for AI processing
   * @param {Array} embeds - Array of embed data objects
   * @returns {string} - Formatted text representation
   */
  formatEmbedsAsText(embeds) {
    if (!embeds || embeds.length === 0) {
      return '';
    }

    const formattedEmbeds = embeds.map((embed, index) => {
      return this.formatSingleEmbed(embed, embeds.length > 1 ? index + 1 : null);
    }).filter(text => text.length > 0);

    return formattedEmbeds.join('\n\n');
  }

  /**
   * Format a single embed as readable text
   * @param {Object} embed - Single embed data object
   * @param {number|null} embedNumber - Embed number if multiple embeds
   * @returns {string} - Formatted text
   */
  formatSingleEmbed(embed, embedNumber = null) {
    const lines = [];
    const header = embedNumber ? `[Embed ${embedNumber}]` : '[Embedded Content]';
    lines.push(header);

    // Add author if present
    if (embed.author && embed.author.name) {
      lines.push(`Author: ${embed.author.name}`);
    }

    // Add title
    if (embed.metadata.title) {
      lines.push(`Title: ${embed.metadata.title}`);
    }

    // Add description (truncated if too long)
    if (embed.metadata.description) {
      const description = this.truncateText(embed.metadata.description, this.maxDescriptionLength);
      lines.push(`Description: ${description}`);
    }

    // Add fields
    if (embed.fields && embed.fields.length > 0) {
      embed.fields.forEach(field => {
        const value = this.truncateText(field.value, this.maxFieldLength);
        lines.push(`${field.name}: ${value}`);
      });
    }

    // Add media references
    const mediaInfo = this.formatMediaInfo(embed.media);
    if (mediaInfo) {
      lines.push(mediaInfo);
    }

    // Add URL if present
    if (embed.metadata.url) {
      lines.push(`URL: ${embed.metadata.url}`);
    }

    // Add footer
    if (embed.footer && embed.footer.text) {
      lines.push(`Footer: ${embed.footer.text}`);
    }

    return lines.join('\n');
  }

  /**
   * Format media information as text
   * @param {Object} media - Media object from embed
   * @returns {string|null} - Formatted media info
   */
  formatMediaInfo(media) {
    const mediaItems = [];

    if (media.image && media.image.url) {
      mediaItems.push('image');
    }

    if (media.video && media.video.url) {
      mediaItems.push('video');
    }

    if (media.thumbnail && media.thumbnail.url) {
      mediaItems.push('thumbnail');
    }

    if (mediaItems.length === 0) {
      return null;
    }

    return `[Contains: ${mediaItems.join(', ')}]`;
  }

  /**
   * Format embeds for conversation history
   * @param {Array} embeds - Array of embed data objects
   * @returns {string} - Compact format for history
   */
  formatEmbedsForHistory(embeds) {
    if (!embeds || embeds.length === 0) {
      return '';
    }

    const summaries = embeds.map(embed => {
      const parts = [];

      if (embed.metadata.title) {
        parts.push(embed.metadata.title);
      } else if (embed.author && embed.author.name) {
        parts.push(`by ${embed.author.name}`);
      } else if (embed.metadata.url) {
        parts.push('link');
      }

      return parts.length > 0 ? parts.join(' ') : 'embedded content';
    });

    return `[Embeds: ${summaries.join(', ')}]`;
  }

  /**
   * Format embeds for "You are replying to" section
   * @param {Array} embeds - Array of embed data objects
   * @returns {string} - Context format for AI prompt
   */
  formatEmbedsForReplyContext(embeds) {
    if (!embeds || embeds.length === 0) {
      return '';
    }

    // For reply context, we want more detail than history but less than full format
    const contextItems = embeds.map(embed => {
      const parts = [];

      if (embed.metadata.title && embed.metadata.description) {
        const shortDesc = this.truncateText(embed.metadata.description, 100);
        parts.push(`"${embed.metadata.title}" - ${shortDesc}`);
      } else if (embed.metadata.title) {
        parts.push(`"${embed.metadata.title}"`);
      } else if (embed.metadata.description) {
        const shortDesc = this.truncateText(embed.metadata.description, 150);
        parts.push(shortDesc);
      }

      // Add key fields if no title/description
      if (parts.length === 0 && embed.fields.length > 0) {
        const firstField = embed.fields[0];
        parts.push(`${firstField.name}: ${this.truncateText(firstField.value, 80)}`);
      }

      return parts.length > 0 ? parts.join(' - ') : 'embedded content';
    });

    return `[${contextItems.join(' | ')}]`;
  }

  /**
   * Truncate text to specified length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  truncateText(text, maxLength, skipTruncation = false) {
    if (!text || text.length <= maxLength || skipTruncation) {
      return text;
    }

    return text.substring(0, maxLength - 3).trim() + '...';
  }

  /**
   * Create a summary of embed content for logging
   * @param {Array} embeds - Array of embed data objects
   * @returns {Object} - Summary object
   */
  createEmbedSummary(embeds) {
    if (!embeds || embeds.length === 0) {
      return { count: 0, types: [], hasContent: false };
    }

    return {
      count: embeds.length,
      types: [...new Set(embeds.map(e => e.type))],
      hasContent: true,
      hasTitles: embeds.some(e => e.metadata.title),
      hasDescriptions: embeds.some(e => e.metadata.description),
      hasFields: embeds.some(e => e.fields.length > 0),
      hasMedia: embeds.some(e => e.media.image || e.media.video),
      preview: embeds[0].metadata.title || embeds[0].metadata.description || 'No preview'
    };
  }
}

module.exports = EmbedFormatter;