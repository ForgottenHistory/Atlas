const Action = require('../interfaces/Action');
const TypingSimulator = require('../../actions/TypingSimulator');
const logger = require('../../../logger/Logger');

/**
 * Enhanced Response action with full Discord reply support
 * Handles both normal messages and Discord replies based on configuration
 */
class ResponseAction extends Action {
  constructor(config = {}, dependencies = {}) {
    super(config, dependencies);
    
    this.discordClient = dependencies.discordClient;
    this.responseGenerator = dependencies.responseGenerator;
    this.conversationManager = dependencies.conversationManager;
    this.typingSimulator = new TypingSimulator();
    
    // Configuration flags
    this.forceReply = config.forceReply || false;
    this.enableTypingIndicator = config.enableTypingIndicator !== false;
    
    if (!this.discordClient) {
      throw new Error('ResponseAction requires discordClient dependency');
    }
    
    if (!this.responseGenerator) {
      throw new Error('ResponseAction requires responseGenerator dependency');
    }
  }

  /**
   * Execute response action - supports both normal and reply based on config/decision
   */
  async execute(context) {
    const { message, decision, originalMessage } = context;
    
    try {
      // Use original Discord message for channel access
      const discordMessage = originalMessage || message._originalMessage;
      if (!discordMessage?.channel) {
        return this.error(new Error('No Discord channel available for response'));
      }

      // Add realistic typing delay if enabled
      if (this.enableTypingIndicator) {
        await this.typingSimulator.simulateTyping(discordMessage.channel);
      }

      // Generate response using existing system
      const result = await this.responseGenerator.generateResponse(discordMessage);

      if (!result.success) {
        return this.error(new Error(result.error || 'Response generation failed'));
      }

      // Determine if we should use reply or normal send
      const shouldReply = this.shouldUseReply(decision, discordMessage);
      let sentMessage;

      if (shouldReply) {
        // Use Discord's reply function
        try {
          sentMessage = await discordMessage.reply(result.response);
          
          logger.success('Response action completed (Discord reply)', {
            source: 'plugin',
            plugin: this.name,
            channel: discordMessage.channel?.name || 'Unknown',
            responseLength: result.response.length,
            messageId: sentMessage.id,
            repliedTo: discordMessage.id
          });

        } catch (replyError) {
          logger.warn('Discord reply failed, falling back to normal send', {
            source: 'plugin',
            plugin: this.name,
            error: replyError.message,
            messageId: discordMessage.id
          });
          
          // Fallback to normal send
          sentMessage = await discordMessage.channel.send(result.response);
        }
      } else {
        // Normal channel send
        sentMessage = await discordMessage.channel.send(result.response);
        
        logger.success('Response action completed (normal send)', {
          source: 'plugin',
          plugin: this.name,
          channel: discordMessage.channel?.name || 'Unknown',
          responseLength: result.response.length,
          messageId: sentMessage.id
        });
      }

      // Add bot response to conversation history
      if (this.conversationManager) {
        this.conversationManager.addMessage(sentMessage, true);
      }

      return this.success({
        action: shouldReply ? 'reply' : 'respond',
        sentMessage: {
          id: sentMessage.id,
          content: sentMessage.content,
          timestamp: sentMessage.createdTimestamp
        },
        originalResponse: result.response,
        responseType: shouldReply ? 'discord_reply' : 'normal_send',
        repliedTo: shouldReply ? discordMessage.id : null
      });

    } catch (error) {
      logger.error('Response action failed', {
        source: 'plugin',
        plugin: this.name,
        error: error.message,
        channel: context.message?.channel?.name || 'Unknown'
      });
      
      return this.error(error);
    }
  }

  /**
   * Determine whether to use Discord's reply function
   */
  shouldUseReply(decision, discordMessage) {
    // If config forces reply mode
    if (this.forceReply) {
      return true;
    }

    // If decision explicitly specifies reply action
    if (decision?.action === 'reply') {
      return true;
    }

    // Smart logic: Use reply for recent messages (within 2 minutes)
    const messageAge = Date.now() - discordMessage.createdTimestamp;
    const isRecent = messageAge < 120000; // 2 minutes

    return isRecent;
  }

  /**
   * Check if action can execute
   */
  async canExecute(context) {
    const { message, originalMessage } = context;
    
    // Check if we have access to a Discord channel
    const discordMessage = originalMessage || message._originalMessage;
    const channel = discordMessage?.channel;
    
    if (!channel) {
      return false;
    }

    // Check basic send permissions
    const botMember = channel.guild?.members?.cache?.get(this.discordClient.getClient()?.user?.id);
    if (botMember && !channel.permissionsFor(botMember)?.has('SendMessages')) {
      return false;
    }

    return true;
  }

  /**
   * Get action metadata
   */
  getMetadata() {
    return {
      name: 'ResponseAction',
      type: 'action',
      description: 'Generates and sends responses as Discord messages or replies',
      discordPermissions: ['SendMessages'],
      discordFeatures: ['messages', 'replies', 'typing_indicator'],
      estimatedExecutionTime: '2-5s',
      rateLimitSensitive: true,
      supportsReply: true,
      supportsNormalSend: true
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

    // Check for response generator
    if (!this.responseGenerator) {
      result.valid = false;
      result.errors.push('Response generator not available');
    }

    // Check for channel access
    const { message, originalMessage } = context;
    const discordMessage = originalMessage || message._originalMessage;
    
    if (!discordMessage?.channel) {
      result.valid = false;
      result.errors.push('No Discord channel available');
    }

    return result;
  }
}

module.exports = ResponseAction;