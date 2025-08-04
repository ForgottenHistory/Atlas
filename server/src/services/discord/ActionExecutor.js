const ActionRouter = require('./actions/ActionRouter');
const ActionLogger = require('./actions/ActionLogger');
const ActionValidator = require('./actions/ActionValidator');
const logger = require('../logger/Logger');

class ActionExecutor {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;

    // Initialize focused services
    this.router = new ActionRouter(discordClient, conversationManager);
    this.actionLogger = new ActionLogger();
    this.validator = new ActionValidator(discordClient);

    logger.info('ActionExecutor initialized', {
      source: 'discord',
      supportedActions: ['respond', 'reply', 'react', 'ignore', 'status_change', 'typing']
    });
  }

  async executeAction(decision, message) {
    try {
      // Log the action decision with batch context
      this.actionLogger.logActionDecision(decision, message);

      // Validate the action can be performed
      const validation = this.validator.validateAction(decision, message);
      if (!validation.canExecute) {
        logger.warn('Action execution blocked', {
          source: 'discord',
          action: decision.action,
          reason: validation.reason,
          channel: message.channel.name,
          isBatch: !!(message.originalMessages && message.originalMessages.length > 1)
        });
        return { success: false, error: validation.reason };
      }

      // Handle batch-specific logic for responses and replies
      if ((decision.action === 'respond' || decision.action === 'reply') && this.isBatchedMessage(message)) {
        return await this.handleBatchedResponse(decision, message);
      }

      // Route to appropriate action handler for non-batched or non-response actions
      const result = await this.router.routeAction(decision, message);

      // Log the result
      this.actionLogger.logActionResult(decision, message, result);

      return result;

    } catch (error) {
      logger.error('Action execution failed', {
        source: 'discord',
        action: decision.action,
        error: error.message,
        channel: message.channel.name,
        isBatch: this.isBatchedMessage(message)
      });
      return { success: false, error: error.message };
    }
  }

  async handleBatchedResponse(decision, message) {
    try {
      // For batched messages, we need to choose which specific message to reply to
      const targetMessage = this.selectReplyTarget(decision, message);

      logger.info('Handling batched response', {
        source: 'discord',
        action: decision.action,
        batchSize: message.originalMessages?.length || 1,
        targetMessageId: targetMessage.id,
        channel: message.channel.name
      });

      // Generate response using the combined content but reply to the specific target
      const responseAction = this.router.actions.get('respond');

      if (decision.action === 'reply') {
        // Use Discord's reply function on the target message
        const result = await responseAction.executeReply(targetMessage, decision);

        logger.success('Batch reply completed', {
          source: 'discord',
          batchSize: message.originalMessages?.length || 1,
          targetMessageId: targetMessage.id,
          channel: message.channel.name
        });

        return result;
      } else {
        // Normal respond action (send to channel)
        const result = await responseAction.executeRespond(message, decision);

        logger.success('Batch response completed', {
          source: 'discord',
          batchSize: message.originalMessages?.length || 1,
          channel: message.channel.name
        });

        return result;
      }

    } catch (error) {
      logger.error('Batch response handling failed', {
        source: 'discord',
        action: decision.action,
        error: error.message,
        batchSize: message.originalMessages?.length || 1,
        channel: message.channel.name
      });
      return { success: false, error: error.message };
    }
  }

  selectReplyTarget(decision, message) {
    // If it's not actually a batch, return the message itself
    if (!message.originalMessages || message.originalMessages.length <= 1) {
      return message;
    }

    const originalMessages = message.originalMessages;

    // Smart selection logic for which message to reply to

    // 1. If there's an image in the batch, prefer replying to the image message
    const imageMessage = originalMessages.find(msg =>
      msg.attachments && msg.attachments.size > 0
    );
    if (imageMessage) {
      logger.debug('Selected image message as reply target', {
        source: 'discord',
        messageId: imageMessage.id,
        batchSize: originalMessages.length
      });
      return imageMessage;
    }

    // 2. If there's a question (contains ?), reply to that
    const questionMessage = originalMessages.find(msg =>
      msg.content && msg.content.includes('?')
    );
    if (questionMessage) {
      logger.debug('Selected question message as reply target', {
        source: 'discord',
        messageId: questionMessage.id,
        batchSize: originalMessages.length
      });
      return questionMessage;
    }

    // 3. If there's a message with significant content (not just a link), prefer that
    const substantialMessage = originalMessages.find(msg =>
      msg.content && msg.content.trim().length > 20 && !this.isUrlOnly(msg.content)
    );
    if (substantialMessage) {
      logger.debug('Selected substantial message as reply target', {
        source: 'discord',
        messageId: substantialMessage.id,
        contentLength: substantialMessage.content.length,
        batchSize: originalMessages.length
      });
      return substantialMessage;
    }

    // 4. Default: reply to the last message in the batch
    const lastMessage = originalMessages[originalMessages.length - 1];
    logger.debug('Selected last message as reply target (default)', {
      source: 'discord',
      messageId: lastMessage.id,
      batchSize: originalMessages.length
    });

    return lastMessage;
  }

  isBatchedMessage(message) {
    return !!(message.originalMessages && message.originalMessages.length > 1);
  }

  isUrlOnly(content) {
    const urlRegex = /^https?:\/\/[^\s]+$/;
    return urlRegex.test(content.trim());
  }

  // Utility method to check if bot can perform actions in channel
  canActInChannel(channel) {
    return this.validator.canActInChannel(channel);
  }

  // Get execution statistics
  getExecutionStats() {
    return this.actionLogger.getStats();
  }

  // Get supported actions
  getSupportedActions() {
    return this.router.getSupportedActions();
  }
}

module.exports = ActionExecutor;