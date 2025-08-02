class EmoteFilter {
  constructor() {
    // Discord emote patterns
    this.customEmoteRegex = /<a?:[a-zA-Z0-9_]+:[0-9]+>/g; // <:name:id> or <a:name:id>
    this.unicodeEmoteRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  }

  /**
   * Remove all emotes from text
   * @param {string} text - Input text
   * @returns {string} - Text with emotes removed
   */
  removeEmotes(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // Remove custom Discord emotes: <:name:id> and <a:name:id>
      .replace(this.customEmoteRegex, '')
      // Remove Unicode emojis
      .replace(this.unicodeEmoteRegex, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if message contains only emotes (and whitespace)
   * @param {string} text - Input text
   * @returns {boolean} - True if message is emote-only
   */
  isEmoteOnly(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const withoutEmotes = this.removeEmotes(text);
    return withoutEmotes.length === 0;
  }

  /**
   * Check if message contains any emotes
   * @param {string} text - Input text
   * @returns {boolean} - True if message contains emotes
   */
  hasEmotes(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    return this.customEmoteRegex.test(text) || this.unicodeEmoteRegex.test(text);
  }

  /**
   * Get emote statistics for a message
   * @param {string} text - Input text
   * @returns {object} - Emote statistics
   */
  getEmoteStats(text) {
    if (!text || typeof text !== 'string') {
      return {
        customEmotes: 0,
        unicodeEmotes: 0,
        totalEmotes: 0,
        isEmoteOnly: false,
        cleanText: ''
      };
    }

    const customMatches = text.match(this.customEmoteRegex) || [];
    const unicodeMatches = text.match(this.unicodeEmoteRegex) || [];
    const cleanText = this.removeEmotes(text);

    return {
      customEmotes: customMatches.length,
      unicodeEmotes: unicodeMatches.length,
      totalEmotes: customMatches.length + unicodeMatches.length,
      isEmoteOnly: cleanText.length === 0,
      cleanText: cleanText
    };
  }

  /**
   * Extract emotes from text
   * @param {string} text - Input text
   * @returns {object} - Extracted emotes
   */
  extractEmotes(text) {
    if (!text || typeof text !== 'string') {
      return {
        customEmotes: [],
        unicodeEmotes: []
      };
    }

    const customEmotes = text.match(this.customEmoteRegex) || [];
    const unicodeEmotes = text.match(this.unicodeEmoteRegex) || [];

    return {
      customEmotes,
      unicodeEmotes
    };
  }
}

// Create singleton instance
const emoteFilter = new EmoteFilter();

module.exports = emoteFilter;