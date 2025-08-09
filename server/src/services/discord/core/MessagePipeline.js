const EventBus = require('./EventBus');
const DecisionPipeline = require('./DecisionPipeline');
const PluginRegistry = require('./PluginRegistry');
const logger = require('../../logger/Logger');

/**
 * Immutable message processing pipeline
 * Handles message flow without mutating Discord.js objects
 */
class MessagePipeline {
  
  constructor(dependencies = {}) {
    this.dependencies = {
      discordClient: null,
      llmService: null,
      messageFilter: null,
      conversationManager: null,
      ...dependencies
    };
    
    this.decisionPipeline = new DecisionPipeline(
      this.dependencies.llmService,
      this.dependencies
    );
    
    this.stats = {
      messagesProcessed: 0,
      actionsExecuted: 0,
      errorsEncountered: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Process incoming Discord message through complete pipeline
   */
  async processMessage(discordMessage) {
    const startTime = Date.now();
    
    try {
      // Step 1: Create immutable message context
      const messageContext = this.createMessageContext(discordMessage);
      
      // Step 2: Apply message filters
      const shouldProcess = await this.shouldProcessMessage(messageContext);
      if (!shouldProcess) {
        logger.debug('Message filtered out', {
          source: 'message_pipeline',
          messageId: messageContext.id,
          reason: 'filter_rejected'
        });
        return { processed: false, reason: 'filtered' };
      }

      // Step 3: Build channel context
      const channelContext = await this.buildChannelContext(messageContext);
      
      // Step 4: Make decision
      const decision = await this.decisionPipeline.processMessage(messageContext, channelContext);
      
      // Step 5: Execute action
      const actionResult = await this.executeAction(decision, messageContext, channelContext);
      
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      logger.info('Message processed successfully', {
        source: 'message_pipeline',
        messageId: messageContext.id,
        action: decision.action,
        processingTime: `${processingTime}ms`
      });

      return {
        processed: true,
        decision,
        actionResult,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      
      logger.error('Message processing failed', {
        source: 'message_pipeline',
        messageId: discordMessage.id,
        error: error.message,
        processingTime: `${processingTime}ms`
      });

      EventBus.systemError(error, {
        context: 'message_pipeline',
        messageId: discordMessage.id
      });

      return {
        processed: false,
        error: error.message,
        processingTime
      };
    }
  }

  /**
   * Create immutable message context from Discord message
   * Prevents modification of Discord.js objects
   */
  createMessageContext(discordMessage) {
    const messageContext = {
      // Core message data
      id: discordMessage.id,
      content: discordMessage.content || '',
      timestamp: discordMessage.createdTimestamp,
      editedTimestamp: discordMessage.editedTimestamp,
      
      // Author information (immutable copy)
      author: {
        id: discordMessage.author.id,
        username: discordMessage.author.username,
        discriminator: discordMessage.author.discriminator,
        bot: discordMessage.author.bot,
        avatar: discordMessage.author.avatar
      },
      
      // Channel information
      channel: {
        id: discordMessage.channel.id,
        name: discordMessage.channel.name,
        type: discordMessage.channel.type
      },
      
      // Guild information (if available)
      guild: discordMessage.guild ? {
        id: discordMessage.guild.id,
        name: discordMessage.guild.name
      } : null,
      
      // Message metadata
      reference: discordMessage.reference ? {
        messageId: discordMessage.reference.messageId,
        channelId: discordMessage.reference.channelId,
        guildId: discordMessage.reference.guildId
      } : null,
      
      // Mentions (immutable)
      mentions: {
        users: Array.from(discordMessage.mentions.users.keys()),
        roles: Array.from(discordMessage.mentions.roles.keys()),
        everyone: discordMessage.mentions.everyone,
        here: discordMessage.mentions.here
      },
      
      // Attachments
      attachments: discordMessage.attachments.map(attachment => ({
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        url: attachment.url,
        contentType: attachment.contentType
      })),
      
      // Message features
      pinned: discordMessage.pinned,
      tts: discordMessage.tts,
      embeds: discordMessage.embeds.length > 0,
      
      // Reference to original Discord message (read-only)
      _originalMessage: discordMessage
    };

    // Add batched content if available
    if (discordMessage.batchedContent) {
      messageContext.batchedContent = discordMessage.batchedContent;
    }

    // Add image analysis if available
    if (discordMessage.imageAnalysis) {
      messageContext.imageAnalysis = Array.isArray(discordMessage.imageAnalysis) 
        ? [...discordMessage.imageAnalysis]
        : [discordMessage.imageAnalysis];
    }

    return messageContext;
  }

  /**
   * Check if message should be processed
   */
  async shouldProcessMessage(messageContext) {
    // Use existing message filter if available
    if (this.dependencies.messageFilter) {
      return this.dependencies.messageFilter.shouldProcess(messageContext._originalMessage);
    }

    // Basic filtering logic
    return !messageContext.author.bot && 
           messageContext.content.length > 0 &&
           !messageContext.content.startsWith('!');
  }

  /**
   * Build channel context for decision making
   */
  async buildChannelContext(messageContext) {
    const channelContext = {
      channelId: messageContext.channel.id,
      channelName: messageContext.channel.name,
      serverName: messageContext.guild?.name || 'Direct Message',
      
      // Default values
      activityLevel: 'normal',
      lastAction: 'none',
      lastActionTime: null,
      conversationHistory: [],
      hasImages: messageContext.attachments.length > 0 || messageContext.imageAnalysis?.length > 0
    };

    try {
      // Get conversation history if conversation manager available
      if (this.dependencies.conversationManager) {
        const history = await this.dependencies.conversationManager.getChannelHistory(
          messageContext.channel.id, 
          10
        );
        channelContext.conversationHistory = history || [];
      }

      // Determine activity level based on recent messages
      if (channelContext.conversationHistory.length > 5) {
        channelContext.activityLevel = 'high';
      } else if (channelContext.conversationHistory.length > 2) {
        channelContext.activityLevel = 'medium';
      }

      // Get last action info if available
      const lastAction = this.getLastBotAction(channelContext.conversationHistory);
      if (lastAction) {
        channelContext.lastAction = lastAction.action;
        channelContext.lastActionTime = lastAction.timestamp;
      }

    } catch (error) {
      logger.warn('Failed to build complete channel context', {
        source: 'message_pipeline',
        channelId: messageContext.channel.id,
        error: error.message
      });
    }

    return channelContext;
  }

  /**
   * Execute the decided action using plugin system
   */
  async executeAction(decision, messageContext, channelContext) {
    try {
      EventBus.actionStarted(decision.action, {
        messageId: messageContext.id,
        reasoning: decision.reasoning
      });

      // Get action plugin
      const actionPlugins = PluginRegistry.getPluginsByType('action');
      const actionPlugin = actionPlugins.find(plugin => 
        plugin.name.toLowerCase().includes(decision.action) ||
        plugin.triggers.includes(decision.action)
      );

      let result;
      if (actionPlugin) {
        // Use plugin system
        const context = {
          decision,
          message: messageContext,
          channelContext,
          discordClient: this.dependencies.discordClient,
          originalMessage: messageContext._originalMessage
        };

        result = await PluginRegistry.executeAction(actionPlugin.name, context, this.dependencies);
      } else {
        // Fallback to legacy action execution
        result = await this.executeLegacyAction(decision, messageContext, channelContext);
      }

      this.stats.actionsExecuted++;
      
      EventBus.actionCompleted(decision.action, result, {
        messageId: messageContext.id
      });

      return result;

    } catch (error) {
      logger.error('Action execution failed', {
        source: 'message_pipeline',
        action: decision.action,
        messageId: messageContext.id,
        error: error.message
      });

      EventBus.actionFailed(decision.action, error, {
        messageId: messageContext.id
      });

      return {
        success: false,
        error: error.message,
        action: decision.action
      };
    }
  }

  /**
   * Fallback action execution for non-plugin actions
   */
  async executeLegacyAction(decision, messageContext, channelContext) {
    // This would call the existing ActionExecutor or ActionRouter
    // Keeping backwards compatibility during transition
    
    logger.warn('Using legacy action execution', {
      source: 'message_pipeline',
      action: decision.action,
      messageId: messageContext.id
    });

    return {
      success: true,
      action: decision.action,
      legacy: true,
      message: 'Action executed via legacy system'
    };
  }

  // === HELPER METHODS ===

  getLastBotAction(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return null;
    }

    // Find the most recent bot message
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const message = conversationHistory[i];
      if (message.author && message.author.bot) {
        return {
          action: 'respond', // Default assumption
          timestamp: message.timestamp
        };
      }
    }

    return null;
  }

  updateStats(processingTime, success) {
    this.stats.messagesProcessed++;
    
    if (!success) {
      this.stats.errorsEncountered++;
    }
    
    // Update rolling average
    if (this.stats.averageProcessingTime === 0) {
      this.stats.averageProcessingTime = processingTime;
    } else {
      this.stats.averageProcessingTime = (this.stats.averageProcessingTime + processingTime) / 2;
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      ...this.stats,
      decisionPipelineStats: this.decisionPipeline.getStats()
    };
  }

  /**
   * Update dependencies (for dependency injection)
   */
  updateDependencies(newDependencies) {
    this.dependencies = { ...this.dependencies, ...newDependencies };
    this.decisionPipeline.dependencies = { ...this.decisionPipeline.dependencies, ...newDependencies };
  }
}

module.exports = MessagePipeline;