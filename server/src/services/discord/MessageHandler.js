const storage = require('../../utils/storage');
const logger = require('../logger/Logger');
const ConversationManager = require('./ConversationManager');
const CommandHandler = require('./commands/CommandHandler');
const ResponseGenerator = require('./response/ResponseGenerator');
const MessageFilter = require('./MessageFilter');
const MessageBatcher = require('./MessageBatcher');
const MultiLLMDecisionEngine = require('../llm/MultiLLMDecisionEngine');
const ActionExecutor = require('./ActionExecutor');
const imageProcessingService = require('../image_processing/ImageProcessingService');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    
    // Initialize specialized services
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager);
    this.messageFilter = new MessageFilter();
    this.messageBatcher = new MessageBatcher(3000); // 3 second timeout
    this.imageProcessor = imageProcessingService;
    
    // NEW: Autonomous decision making
    this.decisionEngine = new MultiLLMDecisionEngine();
    this.actionExecutor = new ActionExecutor(discordClient, this.conversationManager);
    
    this.setupMessageListener();
    
    logger.info('MessageHandler initialized with autonomous decision making and image processing', { 
      source: 'discord',
      services: ['ConversationManager', 'CommandHandler', 'ResponseGenerator', 'MessageFilter', 'MessageBatcher', 'DecisionEngine', 'ActionExecutor', 'ImageProcessingService']
    });
  }

  setupMessageListener() {
    const client = this.discordClient.getClient();
    if (!client) return;

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      await this.handleMessage(message);
      
      // Emit message received event
      this.emit('messageReceived', {
        author: message.author.username,
        content: message.content,
        guild: message.guild?.name || 'DM',
        channel: message.channel.name || 'DM'
      });
    });
  }

  async handleMessage(message) {
    try {
      // Delegate to filter service for basic validation
      const shouldProcess = this.messageFilter.shouldProcessMessage(message, this.channelManager);
      if (!shouldProcess.shouldProcess) {
        return; // Skip processing based on filter decision
      }
      
      // Check if it's a command
      const settings = storage.getSettings();
      const prefix = settings.commandPrefix || '!';
      
      if (message.content.startsWith(prefix)) {
        return await this.commandHandler.handleCommand(message);
      }

      // NEW: Check for images in the message and process them BEFORE adding to history
      const hasImages = this.messageFilter.messageHasImages(message);
      if (hasImages) {
        await this.processMessageImages(message);
      }

      // Filter and clean the message
      const filterResult = this.messageFilter.filterMessage(message);
      if (!filterResult.shouldProcess) {
        logger.debug('Message filtered out', {
          source: 'discord',
          reason: filterResult.reason,
          author: message.author.username
        });
        return;
      }

      // Add to conversation history (now with image analysis if present)
      await this.conversationManager.addMessage(message);

      // NEW: Use MultiLLM Decision Engine for autonomous decision making
      try {
        const decision = await this.decisionEngine.makeDecision({
          message: filterResult.cleanedMessage,
          channel: message.channel,
          author: message.author,
          conversationHistory: this.conversationManager.getHistory(message.channel.id, 10),
          hasImages: hasImages
        });

        logger.info('Decision engine result', {
          source: 'discord',
          author: message.author.username,
          channel: message.channel.name,
          action: decision.action,
          confidence: decision.confidence,
          reasoning: decision.reasoning
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

    } catch (error) {
      logger.error('Error in message handler', {
        source: 'discord',
        error: error.message,
        author: message.author?.username || 'Unknown',
        channel: message.channel?.name || 'Unknown'
      });
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

  // Public API - delegate to appropriate services
  getConversationHistory(channelId) {
    return this.conversationManager.getHistory(channelId);
  }

  clearConversationHistory(channelId) {
    return this.conversationManager.clearHistory(channelId);
  }

  getMemoryStats(channelId) {
    return this.conversationManager.getMemoryStats(channelId);
  }

  getBatchStats() {
    return this.messageBatcher.getBatchStats();
  }

  getQueueStats() {
    return this.responseGenerator.getQueueStats();
  }

  getQueueHealth() {
    return this.responseGenerator.getQueueHealth();
  }

  // NEW: Get decision engine stats
  getDecisionStats() {
    return {
      lastDecisionTime: this.decisionEngine.lastDecisionTime,
      timeSinceLastAction: this.decisionEngine.timeSinceLastAction()
    };
  }

  // NEW: Get image processing stats
  getImageProcessingStats() {
    return this.imageProcessor.getStats();
  }

  // Event system
  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('Error in message handler event', {
          source: 'discord',
          event: event,
          error: error.message
        });
      }
    });
  }
}

module.exports = MessageHandler;