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

    // Autonomous decision making with tool support
    this.decisionEngine = new MultiLLMDecisionEngine();
    this.actionExecutor = new ActionExecutor(discordClient, this.conversationManager);

    // Initialize tool system
    this.initializeToolSystem();
  }

  initializeToolSystem() {
    try {
      // Initialize tool executor in decision engine
      this.decisionEngine.initializeToolExecutor(this.discordClient, this.conversationManager);
      
      logger.success('Tool system initialized in MessageProcessor', {
        source: 'discord',
        availableTools: this.decisionEngine.getAvailableTools()
      });
    } catch (error) {
      logger.error('Failed to initialize tool system', {
        source: 'discord',
        error: error.message
      });
    }
  }

  async processMessage(message) {
    try {
      // DEFENSIVE: Validate message object
      if (!message) {
        logger.warn('Received null/undefined message', { source: 'discord' });
        return;
      }

      // FIXED: Don't create a new object! Just add defensive checks inline
      // Ensure required properties exist with fallbacks
      if (!message.id) message.id = 'unknown';
      if (!message.content) message.content = '';
      if (!message.author) message.author = { username: 'Unknown', id: 'unknown' };
      if (!message.channel) message.channel = { id: 'unknown', name: 'Unknown' };
      if (!message.attachments) message.attachments = new Map();
      if (!message.embeds) message.embeds = [];
      if (!message.createdTimestamp) message.createdTimestamp = Date.now();

      // Delegate to filter service for basic validation
      const shouldProcess = this.messageFilter.shouldProcessMessage(message, this.channelManager);
      if (!shouldProcess.shouldProcess) {
        return; // Skip processing based on filter decision
      }

      // Check if it's a command first (commands bypass batching)
      const settings = storage.getSettings();
      const prefix = settings.commandPrefix || '!';
      if (message.content.startsWith(prefix)) {
        return await this.commandHandler.handleCommand(message);
      }

      // Process images if present
      let imageAnalysis = null;
      if (message.attachments && message.attachments.size > 0) {
        // Get image processing settings from main settings
        const settings = storage.getSettings();
        const llmSettings = settings.llm || {};

        // Check if image processing is enabled
        if (llmSettings.image_provider && llmSettings.image_api_key && llmSettings.image_model) {
          // Build image settings object
          const imageSettings = {
            provider: llmSettings.image_provider,
            model: llmSettings.image_model,
            apiKey: llmSettings.image_api_key,    // For ImageAnalyzer
            api_key: llmSettings.image_api_key,   // For provider validation
            maxSize: llmSettings.image_max_size || 5,
            quality: llmSettings.image_quality || 2
          };

          logger.debug('Processing images with settings', {
            source: 'discord',
            messageId: message.id,
            provider: imageSettings.provider,
            model: imageSettings.model,
            attachmentCount: message.attachments.size
          });

          imageAnalysis = await this.imageProcessor.processMessageImages(message, imageSettings);
          
          if (imageAnalysis && imageAnalysis.length > 0) {
            logger.success('Image analysis completed', {
              source: 'discord',
              messageId: message.id,
              imageCount: imageAnalysis.length,
              provider: imageSettings.provider
            });
          }
        } else {
          logger.debug('Image processing disabled - missing configuration', {
            source: 'discord',
            messageId: message.id,
            hasProvider: !!llmSettings.image_provider,
            hasApiKey: !!llmSettings.image_api_key,
            hasModel: !!llmSettings.image_model
          });
        }
      }

      // Add image analysis to message if available
      if (imageAnalysis) {
        message.imageAnalysis = imageAnalysis;
      }
      
      const addResult = this.conversationManager.addMessage(message);
      if (!addResult) {
        logger.warn('Failed to add message to conversation history', {
          source: 'discord',
          messageId: message.id
        });
        return;
      }

      // Handle batching for rapid successive messages
      await this.messageBatcher.addToBatch(message, async (batchedMessage) => {
        await this.handleProcessedMessage(batchedMessage, imageAnalysis);
      });

    } catch (error) {
      logger.error('Error in processMessage', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message?.id || 'unknown',
        author: message?.author?.username || 'Unknown'
      });
    }
  }

  async handleProcessedMessage(message, imageAnalysis) {
    try {
      // DEFENSIVE: Ensure message exists
      if (!message) {
        logger.warn('handleProcessedMessage called with null message', { source: 'discord' });
        return;
      }

      // Attach image analysis to message for decision making
      if (imageAnalysis) {
        message.imageAnalysis = imageAnalysis;
      }

      // Get conversation history
      const conversationHistory = this.conversationManager.getHistory(message.channel?.id || 'unknown', 10);

      // Build context for decision making
      const context = {
        message: message,
        channel: message.channel,
        author: message.author,
        conversationHistory: conversationHistory,
        conversationManager: this.conversationManager,
        messageFilter: this.messageFilter,
        discordClient: this.discordClient, // Add Discord client to context
        hasImages: !!(imageAnalysis && imageAnalysis.length > 0),
        hasEmbeds: !!(message.embeds && message.embeds.length > 0),
        embedCount: message.embeds ? message.embeds.length : 0,
        isTriggered: false
      };

      // Make decision using decision engine (now with tool support)
      const decision = await this.decisionEngine.makeDecision(context);

      // DEFENSIVE: Ensure decision exists
      if (!decision) {
        logger.warn('Decision engine returned null decision', {
          source: 'discord',
          messageId: message.id
        });
        return;
      }

      logger.info('Decision made with tool support', {
        source: 'discord',
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        channel: message.channel?.name || 'Unknown',
        hasChainMetadata: !!decision.chainMetadata,
        toolsUsed: decision.chainMetadata ? decision.chainMetadata.toolActionCount : 0
      });

      // Log tool usage if any
      if (decision.chainMetadata && decision.chainMetadata.toolActionCount > 0) {
        logger.info('Tool chain execution summary', {
          source: 'tools',
          toolsUsed: decision.chainMetadata.toolActionCount,
          totalTime: decision.chainMetadata.totalChainTime,
          toolResults: decision.chainMetadata.toolResults.map(r => `${r.tool}: ${r.success ? 'success' : 'failed'}`),
          finalAction: decision.action
        });
      }

      // Execute the final decision (only non-tool actions reach ActionExecutor)
      if (!this.isToolAction(decision.action)) {
        await this.actionExecutor.executeAction(decision, message);
      } else {
        // This shouldn't happen due to failsafe, but log it if it does
        logger.warn('Tool action reached ActionExecutor - this should not happen', {
          source: 'discord',
          action: decision.action,
          messageId: message.id
        });
      }

    } catch (error) {
      logger.error('Error processing message with tool support', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message?.id || 'unknown',
        channel: message?.channel?.name || 'Unknown'
      });
    }
  }

  isToolAction(action) {
    const toolActions = ['profile_lookup'];
    return toolActions.includes(action);
  }

  // Stats and monitoring
  getStats() {
    return {
      messageProcessor: {
        // Existing stats...
      },
      decisionEngine: this.decisionEngine.getDecisionStats(),
      toolSystem: this.decisionEngine.getToolStats()
    };
  }

  // Tool management
  getAvailableTools() {
    return this.decisionEngine.getAvailableTools();
  }

  getToolStats() {
    return this.decisionEngine.getToolStats();
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