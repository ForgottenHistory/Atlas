const Action = require('../interfaces/Action');
const TypingSimulator = require('../../actions/TypingSimulator');
const logger = require('../../../logger/Logger');

/**
 * Response action converted to plugin architecture
 * Handles generating and sending responses as normal messages
 */
class ResponseAction extends Action {
  constructor(config = {}, dependencies = {}) {
    super(config, dependencies);
    
    this.discordClient = dependencies.discordClient;
    this.responseGenerator = dependencies.responseGenerator;
    this.typingSimulator = new TypingSimulator();
    
    if (!this.discordClient) {
      throw new Error('ResponseAction requires discordClient dependency');
    }
    
    if (!this.responseGenerator) {
      throw new Error('ResponseAction requires responseGenerator dependency');
    }
  }

  /**
   * Execute response action
   */
  async execute(context) {
    const { message, decision, originalMessage } = context;
    
    try {
      // Use original Discord message for channel access
      const discordMessage = originalMessage || message._originalMessage;
      if (!discordMessage?.channel) {
        return this.error(new Error('No Discord channel available for response'));
      }

      // Add realistic typing delay
      await this.typingSimulator.simulateTyping(discordMessage.channel);

      // Generate response using existing system
      const result = await this.responseGenerator.generateResponse(discordMessage);

      if (!result.success) {
        return this.error(new Error(result.error || 'Response generation failed'));
      }

      // Send as normal message (not a reply)
      const sentMessage = await discordMessage.channel.send(result.response);

      logger.success('Response action completed (normal send)', {
        source: 'plugin',
        plugin: this.name,
        channel: discordMessage.channel?.name || 'Unknown',
        responseLength: result.response.length,
        messageId: sentMessage.id
      });

      return this.success({
        action: 'respond',
        sentMessage: {
          id: sentMessage.id,
          content: sentMessage.content,
          timestamp: sentMessage.createdTimestamp
        },
        originalResponse: result.response,
        responseType: 'normal_send'
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
      description: 'Generates and sends responses as normal Discord messages',
      discordPermissions: ['SendMessages'],
      discordFeatures: ['messages', 'typing_indicator'],
      estimatedExecutionTime: '2-5s',
      rateLimitSensitive: true
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

  /**
   * Handle pre-execution setup
   */
  async onBeforeExecute(context) {
    await super.onBeforeExecute(context);
    
    // Log execution start
    logger.debug('Response action starting', {
      source: 'plugin',
      plugin: this.name,
      messageId: context.message?.id,
      hasDecision: !!context.decision
    });
  }

  /**
   * Handle post-execution cleanup
   */
  async onAfterExecute(context, result) {
    await super.onAfterExecute(context, result);
    
    // Additional response-specific logging
    if (result.success) {
      logger.info('Response sent successfully', {
        source: 'plugin',
        plugin: this.name,
        responseLength: result.data?.originalResponse?.length || 0,
        sentMessageId: result.data?.sentMessage?.id
      });
    }
  }

  /**
   * Handle execution errors
   */
  async onError(context, error) {
    // Don't re-throw, just log and count
    logger.error('Response action error', {
      source: 'plugin',
      plugin: this.name,
      error: error.message,
      messageId: context.message?.id
    });
    
    // Update error count in parent
    await super.onError(context, error);
  }
}

module.exports = ResponseAction;