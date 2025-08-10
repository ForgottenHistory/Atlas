const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');
const ConversationManager = require('../ConversationManager');
const CommandHandler = require('../commands/CommandHandler');
const ResponseGenerator = require('../response/ResponseGenerator');
const MessageFilter = require('../MessageFilter');
const MessageBatcher = require('../MessageBatcher');
const imageProcessingService = require('../../image_processing/ImageProcessingService');

// ONLY plugin system - no legacy imports
const PluginSystem = require('../core/PluginSystem');
const LLMServiceSingleton = require('../../llm/LLMServiceSingleton');

class MessageProcessor {
  constructor(discordClient, channelManager, options = {}) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;

    // Plugin system is always enabled (no toggle)
    this.pluginSystemInitialized = false;

    // Initialize shared services
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager);
    this.messageFilter = new MessageFilter();
    this.messageBatcher = new MessageBatcher(3000);
    this.imageProcessor = imageProcessingService;

    // Initialize plugin system only
    this.initializePluginSystem();
  }

  // Plugin system initialization (no legacy alternative)
  async initializePluginSystem() {
    try {
      const result = await PluginSystem.initialize({
        discordClient: this.discordClient,
        llmService: LLMServiceSingleton.getInstance(),
        conversationManager: this.conversationManager,
        responseGenerator: this.responseGenerator,
        messageFilter: this.messageFilter,
        channelManager: this.channelManager
      });

      if (result.success) {
        this.pluginSystemInitialized = true;
        logger.success('Plugin system initialized in MessageProcessor', {
          source: 'discord',
          pluginsLoaded: result.pluginsLoaded,
          pluginsFailed: result.pluginsFailed
        });
      } else {
        logger.error('Plugin system initialization failed', {
          source: 'discord',
          error: result.error
        });
        throw new Error(`Plugin system failed to initialize: ${result.error}`);
      }
    } catch (error) {
      logger.error('Failed to initialize plugin system', {
        source: 'discord',
        error: error.message
      });
      throw error;
    }
  }

  async processMessage(message) {
    try {
      // Validate message object
      if (!message) {
        logger.warn('Received null/undefined message', { source: 'discord' });
        return;
      }

      // Command handling (unchanged)
      if (message.content?.startsWith('!')) {
        await this.commandHandler.handleCommand(message);
        return;
      }

      // Message filtering (unchanged)
      const shouldProcess = this.messageFilter.shouldProcessMessage(message, this.channelManager);
      if (!shouldProcess.shouldProcess) {
        return;
      }

      // Always use plugin system (no toggle)
      if (!this.pluginSystemInitialized) {
        logger.error('Plugin system not initialized, cannot process message', {
          source: 'discord',
          messageId: message.id
        });
        return;
      }

      await this.processMessageWithPlugins(message);

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

  async processMessageWithPlugins(message) {
    try {
      logger.debug('Processing message with plugin system', {
        source: 'discord',
        messageId: message.id,
        author: message.author?.username,
        hasAttachments: message.attachments?.size > 0
      });

      // Image processing (if enabled)
      let imageAnalysis = null;
      if (message.attachments?.size > 0) {
        try {
          imageAnalysis = await this.imageProcessor.processMessageImages(message);
          logger.debug('Image analysis completed', {
            source: 'discord',
            messageId: message.id,
            analysisCount: imageAnalysis?.length || 0
          });
        } catch (error) {
          logger.error('Image processing failed', {
            source: 'discord',
            messageId: message.id,
            error: error.message
          });
        }
      }

      // Process through plugin system
      const result = await PluginSystem.processMessage(message);

      if (result.processed) {
        logger.info('Message processed successfully via plugin system', {
          source: 'discord',
          messageId: message.id,
          action: result.decision?.action,
          processingTime: result.processingTime
        });
      } else {
        logger.debug('Message not processed by plugin system', {
          source: 'discord',
          messageId: message.id,
          reason: result.reason
        });
      }

    } catch (error) {
      logger.error('Error processing message with plugins', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message?.id || 'unknown'
      });
    }
  }

  // Simple stats (plugin system only)
  getStats() {
    return {
      messageProcessor: {
        pluginSystemInitialized: this.pluginSystemInitialized,
        pluginSystemOnly: true
      },
      pluginSystem: this.pluginSystemInitialized ? PluginSystem.getStatus() : null
    };
  }

  // Tool management (plugin system only)
  getAvailableTools() {
    if (!this.pluginSystemInitialized) {
      return { plugins: [] };
    }
    return {
      plugins: PluginSystem.getStatus().configuredPlugins
    };
  }

  getToolStats() {
    if (!this.pluginSystemInitialized) {
      return { plugins: {} };
    }
    return {
      plugins: PluginSystem.getStatus().pluginRegistry
    };
  }

  // Existing public API methods (unchanged)
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

  getImageProcessor() {
    return this.imageProcessor;
  }

  getMessageBatcher() {
    return this.messageBatcher;
  }

  // Plugin system access
  getPluginSystem() {
    return this.pluginSystemInitialized ? PluginSystem : null;
  }
}

module.exports = MessageProcessor;