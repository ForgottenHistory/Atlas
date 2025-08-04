const EmbedExtractor = require('./EmbedExtractor');
const EmbedFormatter = require('./EmbedFormatter');
const logger = require('../../logger/Logger');

class EmbedProcessor {
  constructor() {
    this.extractor = new EmbedExtractor();
    this.formatter = new EmbedFormatter();
  }

  /**
   * Process all embeds in a message and attach formatted content
   * @param {Object} message - Discord message object
   * @returns {Object} - Processing result with embed data
   */
  processMessageEmbeds(message) {
    if (!this.extractor.hasEmbeds(message)) {
      return {
        hasEmbeds: false,
        embedCount: 0,
        embedData: [],
        formattedContent: '',
        summary: { count: 0, hasContent: false }
      };
    }

    // Extract structured data from embeds
    const embedData = this.extractor.extractEmbedsFromMessage(message);
    
    if (embedData.length === 0) {
      return {
        hasEmbeds: true,
        embedCount: message.embeds.length,
        embedData: [],
        formattedContent: '',
        summary: { count: message.embeds.length, hasContent: false }
      };
    }

    // Format embeds as text for AI processing
    const formattedContent = this.formatter.formatEmbedsAsText(embedData);
    
    // Create summary for logging
    const summary = this.formatter.createEmbedSummary(embedData);

    // Attach processed embed data to message object
    message.embedData = embedData;
    message.embedContent = formattedContent;
    message.hasProcessedEmbeds = true;

    logger.debug('Processed message embeds', {
      source: 'discord',
      messageId: message.id,
      author: message.author.username,
      channel: message.channel.name,
      ...summary
    });

    return {
      hasEmbeds: true,
      embedCount: embedData.length,
      embedData: embedData,
      formattedContent: formattedContent,
      summary: summary
    };
  }

  /**
   * Get embed content formatted for conversation history
   * @param {Object} message - Message with processed embeds
   * @returns {string} - Compact embed representation
   */
  getEmbedContentForHistory(message) {
    if (!message.embedData || message.embedData.length === 0) {
      return '';
    }

    return this.formatter.formatEmbedsForHistory(message.embedData);
  }

  /**
   * Get embed content formatted for "You are replying to" context
   * @param {Object} message - Message with processed embeds
   * @returns {string} - Reply context embed representation
   */
  getEmbedContentForReplyContext(message) {
    if (!message.embedData || message.embedData.length === 0) {
      return '';
    }

    return this.formatter.formatEmbedsForReplyContext(message.embedData);
  }

  /**
   * Determine if a message with embeds should be processed even if text is empty
   * @param {Object} message - Discord message object
   * @returns {boolean} - True if embeds make message worth processing
   */
  shouldProcessForEmbeds(message) {
    if (!this.extractor.hasEmbeds(message)) {
      return false;
    }

    const embedData = this.extractor.extractEmbedsFromMessage(message);
    
    // Process if we have meaningful embed content
    return embedData.length > 0;
  }

  /**
   * Enhance message content with embed information
   * @param {Object} message - Discord message object
   * @returns {string} - Enhanced content including embeds
   */
  createEnhancedMessageContent(message) {
    const originalContent = message.content || '';
    const embedResult = this.processMessageEmbeds(message);
    
    if (!embedResult.hasEmbeds || !embedResult.formattedContent) {
      return originalContent;
    }

    // Combine original message text with embed content
    if (originalContent.trim()) {
      return `${originalContent}\n\n${embedResult.formattedContent}`;
    } else {
      return embedResult.formattedContent;
    }
  }

  /**
   * Check if message has actionable embed content (links, media, etc.)
   * @param {Object} message - Discord message object
   * @returns {Object} - Analysis of embed actionability
   */
  analyzeEmbedActionability(message) {
    const embedResult = this.processMessageEmbeds(message);
    
    if (!embedResult.hasEmbeds) {
      return {
        isActionable: false,
        hasLinks: false,
        hasMedia: false,
        hasRichContent: false,
        recommendedAction: 'ignore'
      };
    }

    const stats = this.extractor.getEmbedStats(embedResult.embedData);
    
    return {
      isActionable: stats.hasText || stats.hasLinks || stats.hasMedia,
      hasLinks: stats.hasLinks,
      hasMedia: stats.hasMedia,
      hasRichContent: stats.hasText || stats.hasFields,
      recommendedAction: this.getRecommendedAction(stats),
      embedTypes: stats.types
    };
  }

  /**
   * Get recommended bot action based on embed content
   * @param {Object} stats - Embed statistics
   * @returns {string} - Recommended action
   */
  getRecommendedAction(stats) {
    // Rich content (news, articles) - likely worth responding to
    if (stats.hasText && stats.hasFields) {
      return 'respond';
    }

    // Simple links or media - maybe react
    if (stats.hasLinks || stats.hasMedia) {
      return 'react';
    }

    // Has some content but not rich - could respond
    if (stats.hasText) {
      return 'respond';
    }

    return 'ignore';
  }

  /**
   * Get processing statistics
   * @returns {Object} - Processing statistics
   */
  getProcessingStats() {
    return {
      extractorStats: this.extractor.supportedTypes,
      formatterLimits: {
        maxFieldLength: this.formatter.maxFieldLength,
        maxDescriptionLength: this.formatter.maxDescriptionLength
      }
    };
  }
}

module.exports = EmbedProcessor;