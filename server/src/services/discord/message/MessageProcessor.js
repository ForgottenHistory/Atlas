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

    // Check if it's a command
    const settings = storage.getSettings();
    const prefix = settings.commandPrefix || '!';

    logger.debug('Checking for command', {
      source: 'discord',
      content: message.content,
      prefix: prefix,
      startsWithPrefix: message.content ? message.content.startsWith(prefix) : false,
      author: message.author.username
    });

    if (message.content && message.content.startsWith(prefix)) {
      logger.info('Command detected, routing to command handler', {
        source: 'discord',
        content: message.content,
        prefix: prefix, // Make sure we log the prefix
        author: message.author.username,
        channel: message.channel.name
      });

      // FIXED: Make sure we pass the prefix parameter
      return await this.commandHandler.handleCommand(message, prefix);
    }

    // Check for images in the message and process them BEFORE adding to history
    const hasImages = this.messageFilter.messageHasImages(message);
    if (hasImages) {
      await this.processMessageImages(message);
    }

    // ENHANCED: Filter and clean the message WITH embed content processing
    const filterResult = this.messageFilter.filterMessage(message);
    if (!filterResult.shouldProcess) {
      logger.debug('Message filtered out', {
        source: 'discord',
        reason: filterResult.reason,
        author: message.author.username,
        hasEmbeds: filterResult.hasEmbeds || false,
        hasImages: filterResult.hasImages || false
      });
      return;
    }

    // Log comprehensive message content info
    if (filterResult.hasEmbeds && filterResult.embedInfo) {
      logger.info('Message contains embed content', {
        source: 'discord',
        author: message.author.username,
        channel: message.channel.name,
        embedCount: filterResult.embedInfo.count,
        embedTypes: filterResult.embedInfo.types,
        hasImages: hasImages,
        hasTextContent: !!message.originalContent,
        embedPreview: filterResult.embedInfo.preview || 'No preview'
      });
    }

    // Add to conversation history (now with embed content if present)
    await this.conversationManager.addMessage(message);

    // Use MultiLLM Decision Engine for autonomous decision making
    try {
      const decision = await this.decisionEngine.makeDecision({
        message: filterResult.cleanedMessage,
        channel: message.channel,
        author: message.author,
        conversationHistory: this.conversationManager.getHistory(message.channel.id, 10),
        conversationManager: this.conversationManager, // Add the conversation manager
        hasImages: hasImages,
        hasEmbeds: filterResult.hasEmbeds || false,
        embedCount: filterResult.embedInfo?.count || 0,
        embedTypes: filterResult.embedInfo?.types || []
      });

      logger.info('Decision engine result', {
        source: 'discord',
        author: message.author.username,
        channel: message.channel.name,
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        hasEmbeds: filterResult.hasEmbeds || false,
        hasImages: hasImages
      });

      // Execute the decided action
      await this.actionExecutor.executeAction(decision, message);

    } catch (decisionError) {
      logger.error('Decision engine failed, falling back to legacy processing', {
        source: 'discord',
        error: decisionError.message,
        author: message.author.username,
        channel: message.channel.name
      });

      // Fallback to legacy batching system
      await this.fallbackToLegacyProcessing(message);
    }
  }

  async processMessageImages(message) {
    try {
      // Get image processing settings from LLM settings
      const llmSettings = storage.getLLMSettings();

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

      logger.info('Processing images in message', {
        source: 'discord',
        messageId: message.id,
        author: message.author.username,
        channel: message.channel.name,
        provider: llmSettings.image_provider,
        model: llmSettings.image_model
      });

      // Process images using the image processing service
      const imageSettings = {
        provider: llmSettings.image_provider,
        apiKey: llmSettings.image_api_key,
        model: llmSettings.image_model,
        quality: llmSettings.image_quality || 2,
        maxSize: llmSettings.image_max_size || 5
      };

      const results = await this.imageProcessor.processMessageImages(message, imageSettings);

      if (results && results.length > 0) {
        // Add image analysis to the message object for later use
        message.imageAnalysis = results;

        logger.success('Image analysis completed', {
          source: 'discord',
          messageId: message.id,
          imageCount: results.length,
          provider: llmSettings.image_provider,
          model: llmSettings.image_model
        });

        // Store image analysis in conversation history
        for (const result of results) {
          await this.conversationManager.addImageAnalysis(message.channel.id, {
            messageId: message.id,
            author: message.author.username,
            imageUrl: result.imageUrl,
            filename: result.filename,
            analysis: result.analysis,
            provider: result.provider,
            model: result.model,
            timestamp: new Date()
          });
        }
      } else {
        logger.debug('No image analysis results returned', {
          source: 'discord',
          messageId: message.id
        });
      }

    } catch (error) {
      logger.error('Failed to process message images', {
        source: 'discord',
        error: error.message,
        messageId: message.id,
        author: message.author.username
      });
      // Don't fail the entire message processing if image analysis fails
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