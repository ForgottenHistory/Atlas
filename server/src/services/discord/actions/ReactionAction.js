const logger = require('../../logger/Logger');

class ReactionAction {
  constructor(discordClient) {
    this.discordClient = discordClient;
  }

  async executeReact(message, emoji) {
    try {
      if (!emoji) {
        // Simple fallback emoji if none specified (LLM should provide emoji)
        emoji = this.getSimpleFallbackEmoji();
      }
      
      await message.react(emoji);
      
      logger.success('React action completed', {
        source: 'discord',
        emoji: emoji,
        channel: message.channel.name,
        messageContent: message.content.substring(0, 50)
      });
      
      return { success: true, actionType: 'react', emoji };
    } catch (error) {
      logger.error('React action failed', {
        source: 'discord',
        error: error.message,
        emoji: emoji,
        channel: message.channel.name
      });
      return { success: false, error: error.message };
    }
  }

  getSimpleFallbackEmoji() {
    // Simple fallback - LLM should handle emoji selection
    const fallbacks = ['👍', '😊', '🤔'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

module.exports = ReactionAction;