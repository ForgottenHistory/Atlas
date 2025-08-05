const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');
const ConversationManager = require('../ConversationManager');
const CommandHandler = require('../commands/CommandHandler');
const ResponseGenerator = require('../response/ResponseGenerator');
const MessageFilter = require('../MessageFilter');
const MessageBatcher = require('../MessageBatcher');
const MultiLLMDecisionEngine = require('../../llm/MultiLLMDecisionEngine');
const ActionExecutor = require('../ActionExecutor');
const imageProcessingService = require('../../image_processing/ImageProcessingService');

class MessageProcessor {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;

    // Initialize specialized services
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager);
    this.messageFilter = new MessageFilter();
    this.messageBatcher = new MessageBatcher(3000); // 3 second timeout
    this.imageProcessor = imageProcessingService;

    // Autonomous decision making
    this.decisionEngine = new MultiLLMDecisionEngine();
    this.actionExecutor = new ActionExecutor(discordClient, this.conversationManager);
  }

  async processMessage(message) {
    // Delegate to filter service for basic validation
    const shouldProcess = this.messageFilter.shouldProcessMessage(message, this.channelManager);
    if (!shouldProcess.shouldProcess) {
      return; // Skip processing based on filter decision
    }

    // Check if it's a command first (commands bypass batching)
    const settings = storage.getSettings();
    const prefix = settings.commandPrefix || '!';

    if (message.content && message.content.startsWith(prefix)) {
      const commandResult = await this.commandHandler.handleCommand(message);
      if (commandResult.handled) {
        logger.info('Command processed successfully', {
          source: 'discord',
          command: commandResult.command,
          author: message.author.username,
          channel: message.channel.name
        });
        return;
      }
    }

    // For non-commands, use the message queue system
    await this.messageBatcher.addToBatch(message, async (batchedMessage) => {
      await this.processBatchedMessage(batchedMessage);
    });
  }

  async processBatchedMessage(message) {
    try {
      // Get filter result for the batched message
      const filterResult = this.messageFilter.filterMessage(message);

      // Process any images in the batch
      const hasImages = await this.processMessageImages(message);
      if (hasImages) {
        logger.info('Images processed for batch', {
          source: 'discord',
          author: message.author.username,
          channel: message.channel.name,
          batchSize: message.originalMessages?.length || 1,
          embedPreview: filterResult.embedInfo.preview || 'No preview'
        });
      }

      // Add the entire batch to conversation history as one unit
      await this.conversationManager.addMessage(message);

      // Use decision engine with batch context
      const decision = await this.decisionEngine.makeDecision({
        message: filterResult.cleanedMessage,
        channel: message.channel,
        author: message.author,
        conversationHistory: this.conversationManager.getHistory(message.channel.id, 10),
        conversationManager: this.conversationManager,
        messageFilter: this.messageFilter,
        hasImages: hasImages,
        hasEmbeds: filterResult.hasEmbeds || false,
        embedCount: filterResult.embedInfo?.count || 0,
        embedTypes: filterResult.embedInfo?.types || [],
        // Batch-specific context
        isBatch: !!(message.originalMessages && message.originalMessages.length > 1),
        batchSize: message.originalMessages?.length || 1,
        batchMessages: message.originalMessages || [message]
      });

      logger.info('Batch decision made', {
        source: 'discord',
        author: message.author.username,
        channel: message.channel.name,
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        batchSize: message.originalMessages?.length || 1,
        hasImages: hasImages
      });

      // Execute the decided action with batch-aware logic
      await this.actionExecutor.executeAction(decision, message);

    } catch (error) {
      logger.error('Error processing batched message', {
        source: 'discord',
        error: error.message,
        author: message.author.username,
        channel: message.channel.name,
        batchSize: message.originalMessages?.length || 1
      });
    }
  }

  async processMessageImages(message) {
    try {
      // FIX: Get image processing settings from main settings
      const settings = storage.getSettings();
      const llmSettings = settings.llm || {};

      logger.debug('Checking image processing settings', {
        source: 'discord',
        image_provider: llmSettings.image_provider,
        hasApiKey: !!llmSettings.image_api_key,
        hasModel: !!llmSettings.image_model,
        messageId: message.id
      });

      // Check if image processing is enabled
      if (!llmSettings.image_provider || llmSettings.image_provider === '') {
        logger.debug('Image processing disabled - no provider set', {
          source: 'discord',
          messageId: message.id,
          author: message.author.username
        });
        return;
      }

      // Validate settings
      if (!llmSettings.image_api_key || !llmSettings.image_model) {
        logger.warn('Image processing enabled but missing API key or model', {
          source: 'discord',
          provider: llmSettings.image_provider,
          hasApiKey: !!llmSettings.image_api_key,
          hasModel: !!llmSettings.image_model
        });
        return;
      }

      // Process images with settings
      const imageSettings = {
        provider: llmSettings.image_provider,
        model: llmSettings.image_model,
        apiKey: llmSettings.image_api_key,    // For ImageAnalyzer
        api_key: llmSettings.image_api_key,   // For provider validation
        maxSize: llmSettings.image_max_size || 5,
        quality: llmSettings.image_quality || 2
      };

      logger.info('Processing images in message', {
        source: 'discord',
        messageId: message.id,
        author: message.author.username,
        channel: message.channel.name,
        provider: imageSettings.provider,
        model: imageSettings.model
      });

      const imageResults = await this.imageProcessor.processMessageImages(message, imageSettings);

      if (imageResults && imageResults.length > 0) {
        message.imageAnalysis = imageResults;

        logger.success('Image analysis completed', {
          source: 'discord',
          messageId: message.id,
          imageCount: imageResults.length,
          provider: imageSettings.provider
        });
      } else {
        logger.debug('No image analysis results returned', {
          source: 'discord',
          messageId: message.id
        });
      }

    } catch (error) {
      logger.error('Failed to process message images', {
        source: 'discord',
        messageId: message.id,
        error: error.message
      });
    }
  }

  async fallbackToLegacyProcessing(message) {
    try {
      // Legacy batching logic with slight improvements
      this.messageBatcher.addMessage(message, async (batchedMessages) => {
        const mostRecentMessage = batchedMessages[batchedMessages.length - 1];
        await this.responseGenerator.generateResponse(mostRecentMessage, batchedMessages);
      });
    } catch (error) {
      logger.error('Error processing message via legacy path', {
        source: 'discord',
        error: error.message,
        author: message.author?.username || 'Unknown',
        channel: message.channel?.name || 'Unknown'
      });
    }
  }

  // Public API methods
  getConversationHistory(channelId) {
    return this.conversationManager.getHistory(channelId);
  }

  clearConversationHistory(channelId) {
    return this.conversationManager.clearHistory(channelId);
  }

  getMemoryStats(channelId) {
    return this.conversationManager.getMemoryStats(channelId);
  }

  getConversationManager() {
    return this.conversationManager;
  }

  getResponseGenerator() {
    return this.responseGenerator;
  }

  getDecisionEngine() {
    return this.decisionEngine;
  }

  getImageProcessor() {
    return this.imageProcessor;
  }

  getMessageBatcher() {
    return this.messageBatcher;
  }
}

module.exports = MessageProcessor;