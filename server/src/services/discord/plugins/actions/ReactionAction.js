const Action = require('../interfaces/Action');
const logger = require('../../../logger/Logger');

/**
 * Reaction action plugin - adds emoji reactions to messages
 * Converted from legacy ReactionAction to plugin architecture
 */
class ReactionAction extends Action {
  constructor(config = {}, dependencies = {}) {
    super(config, dependencies);
    
    this.discordClient = dependencies.discordClient;
    this.defaultEmoji = config.defaultEmoji || '👍';
    this.enableCustomEmojis = config.enableCustomEmojis !== false;
    
    if (!this.discordClient) {
      throw new Error('ReactionAction requires discordClient dependency');
    }
  }

  /**
   * Execute reaction action - add emoji to message
   */
  async execute(context) {
    const { message, decision, originalMessage } = context;
    
    try {
      // Use original Discord message for reaction
      const discordMessage = originalMessage || message._originalMessage;
      if (!discordMessage) {
        return this.error(new Error('No Discord message available for reaction'));
      }

      // Determine which emoji to use
      const emoji = this.determineEmoji(decision, discordMessage);

      // Add reaction to message
      await discordMessage.react(emoji);

      logger.success('Reaction added successfully', {
        source: 'plugin',
        plugin: this.name,
        emoji: emoji,
        messageId: discordMessage.id,
        channel: discordMessage.channel?.name || 'Unknown'
      });

      return this.success({
        action: 'react',
        emoji: emoji,
        reactedTo: discordMessage.id,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Reaction action failed', {
        source: 'plugin',
        plugin: this.name,
        error: error.message,
        emoji: this.determineEmoji(decision, originalMessage),
        messageId: context.message?.id
      });
      
      return this.error(error);
    }
  }

  /**
   * Determine which emoji to use for reaction
   */
  determineEmoji(decision, discordMessage) {
    // Priority order:
    // 1. Decision-specified emoji
    // 2. Context-based emoji selection
    // 3. Default emoji

    if (decision?.emoji) {
      return decision.emoji;
    }

    // Smart emoji selection based on message content
    if (this.enableCustomEmojis) {
      const content = discordMessage?.content?.toLowerCase() || '';
      
      // Positive reactions
      if (content.includes('good') || content.includes('great') || content.includes('awesome')) {
        return '👍';
      }
      
      // Questions
      if (content.includes('?') || content.includes('how') || content.includes('what')) {
        return '🤔';
      }
      
      // Funny content
      if (content.includes('lol') || content.includes('funny') || content.includes('😂')) {
        return '😂';
      }
      
      // Sad/negative content
      if (content.includes('sad') || content.includes('sorry') || content.includes('bad')) {
        return '😢';
      }
      
      // Love/heart content
      if (content.includes('love') || content.includes('heart') || content.includes('❤️')) {
        return '❤️';
      }
    }

    // Default emoji
    return this.defaultEmoji;
  }

  /**
   * Check if action can execute
   */
  async canExecute(context) {
    const { message, originalMessage } = context;
    
    // Check if we have access to a Discord message
    const discordMessage = originalMessage || message._originalMessage;
    if (!discordMessage) {
      return false;
    }

    // Check if message still exists and is accessible
    try {
      // Basic permission check - can we add reactions?
      const channel = discordMessage.channel;
      const botMember = channel.guild?.members?.cache?.get(this.discordClient.getClient()?.user?.id);
      
      if (botMember && !channel.permissionsFor(botMember)?.has('AddReactions')) {
        return false;
      }

      return true;
    } catch (error) {
      logger.warn('Cannot check reaction permissions', {
        source: 'plugin',
        plugin: this.name,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get action metadata
   */
  getMetadata() {
    return {
      name: 'ReactionAction',
      type: 'action',
      description: 'Adds emoji reactions to Discord messages',
      discordPermissions: ['AddReactions'],
      discordFeatures: ['reactions', 'emoji'],
      estimatedExecutionTime: '0.5s',
      rateLimitSensitive: false,
      supportsCustomEmojis: this.enableCustomEmojis,
      defaultEmoji: this.defaultEmoji
    };
  }

  /**
   * Validate execution context
   */
  validateContext(context) {
    const result = super.validateContext(context);
    
    if (!result.valid) {
      return result;
    }

    // Check for Discord message
    const { message, originalMessage } = context;
    const discordMessage = originalMessage || message._originalMessage;
    
    if (!discordMessage) {
      result.valid = false;
      result.errors.push('No Discord message available for reaction');
    }

    return result;
  }
}

module.exports = ReactionAction;