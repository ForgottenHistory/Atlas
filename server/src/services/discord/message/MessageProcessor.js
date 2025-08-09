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

// NEW: Import plugin system
const PluginSystem = require('../core/PluginSystem');
const LLMServiceSingleton = require('../../llm/LLMServiceSingleton');

class MessageProcessor {
  constructor(discordClient, channelManager, options = {}) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;

    // NEW: Plugin system configuration
    this.usePluginSystem = options.usePluginSystem !== false; // Default to true
    this.pluginSystemInitialized = false;

    // Initialize specialized services
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager);
    this.messageFilter = new MessageFilter();
    this.messageBatcher = new MessageBatcher(3000); // 3 second timeout
    this.imageProcessor = imageProcessingService;

    // Autonomous decision making with tool support (legacy)
    this.decisionEngine = new MultiLLMDecisionEngine();
    this.actionExecutor = new ActionExecutor(discordClient, this.conversationManager);

    // Initialize systems
    this.initializeToolSystem(); // Legacy
    this.initializePluginSystem(); // NEW
  }

  // Legacy tool system initialization (kept for backwards compatibility)
  initializeToolSystem() {
    try {
      // Initialize tool executor in decision engine
      this.decisionEngine.initializeToolExecutor(this.discordClient, this.conversationManager);

      logger.success('Legacy tool system initialized in MessageProcessor', {
        source: 'discord',
        availableTools: this.decisionEngine.getAvailableTools()
      });
    } catch (error) {
      logger.error('Failed to initialize legacy tool system', {
        source: 'discord',
        error: error.message
      });
    }
  }

  // NEW: Plugin system initialization
  async initializePluginSystem() {
    if (!this.usePluginSystem) {
      logger.info('Plugin system disabled, using legacy system only', {
        source: 'discord'
      });
      return;
    }

    try {
      // Initialize plugin system with Atlas dependencies
      const result = await PluginSystem.initialize({
        discordClient: this.discordClient,
        llmService: LLMServiceSingleton.getInstance(), // Use actual LLM service
        conversationManager: this.conversationManager,
        responseGenerator: this.responseGenerator,
        messageFilter: this.messageFilter,
        actionExecutor: this.actionExecutor,
        channelManager: this.channelManager // Add channelManager
      });

      if (result.success) {
        this.pluginSystemInitialized = true;
        logger.success('Plugin system initialized in MessageProcessor', {
          source: 'discord',
          pluginsLoaded: result.pluginsLoaded,
          pluginsFailed: result.pluginsFailed
        });
      } else {
        logger.error('Plugin system initialization failed, falling back to legacy', {
          source: 'discord',
          error: result.error
        });
        this.usePluginSystem = false;
      }
    } catch (error) {
      logger.error('Failed to initialize plugin system, falling back to legacy', {
        source: 'discord',
        error: error.message
      });
      this.usePluginSystem = false;
    }
  }

  async processMessage(message) {
    try {
      // DEFENSIVE: Validate message object
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

      // FEATURE TOGGLE: Use plugin system if available, otherwise legacy
      if (this.usePluginSystem && this.pluginSystemInitialized) {
        await this.processMessageWithPlugins(message);
      } else {
        await this.processMessageLegacy(message);
      }

    } catch (error) {
      logger.error('Error in processMessage', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message?.id || 'unknown',
        author: message?.author?.username || 'Unknown',
        usingPluginSystem: this.usePluginSystem && this.pluginSystemInitialized
      });
    }
  }

  async processMessageWithPlugins(message) {
    try {
      logger.debug('Processing message with plugin system', {
        source: 'discord',
        messageId: message.id,
        author: message.author?.username
      });

      // STEP 1: Image processing (same as legacy)
      let imageAnalysis = null;
      if (message.attachments?.size > 0) {
        try {
          const llmSettings = storage.getLLMSettings();
          if (llmSettings.enable_image_analysis) {
            imageAnalysis = await this.imageProcessor.analyzeMessageImages(message);
            
            // Attach image analysis to message for plugin system
            message.imageAnalysis = imageAnalysis;
            
            logger.info('Images processed for plugin system', {
              source: 'image_processing',
              imageCount: imageAnalysis.length,
              hasVisionConfig: !!llmSettings.image_provider,
              hasApiKey: !!llmSettings.image_api_key,
              hasModel: !!llmSettings.image_model
            });
          }
        } catch (error) {
          logger.error('Image processing failed in plugin system', {
            source: 'image_processing',
            error: error.message
          });
          // Continue processing without image analysis
        }
      }

      // STEP 2: Add user message to conversation history FIRST
      this.conversationManager.addMessage(message, false);

      // STEP 3: Message batching with CORRECT method signature
      await this.messageBatcher.addToBatch(message, async (batchedMessage) => {
        try {
          logger.debug('Processing batched message through plugin system', {
            source: 'discord',
            messageId: batchedMessage.id,
            isBatched: batchedMessage.isBatched || false,
            originalLength: message.content?.length || 0,
            batchedLength: batchedMessage.batchedContent?.length || 0
          });

          // Process through plugin-enabled pipeline
          const result = await PluginSystem.processMessage(batchedMessage);
          
          if (result.processed) {
            logger.info('Message processed successfully with plugins', {
              source: 'discord',
              messageId: batchedMessage.id,
              action: result.decision?.action,
              processingTime: result.processingTime
            });
          } else {
            logger.warn('Message processing failed with plugins, trying legacy fallback', {
              source: 'discord',
              messageId: batchedMessage.id,
              reason: result.reason || result.error
            });
            
            // Fallback to legacy if plugin processing fails
            await this.processMessageLegacy(message);
          }

        } catch (error) {
          logger.error('Plugin batched message processing failed, falling back to legacy', {
            source: 'discord',
            messageId: batchedMessage.id,
            error: error.message
          });
          
          // Fallback to legacy processing
          await this.processMessageLegacy(message);
        }
      });

    } catch (error) {
      logger.error('Plugin message processing failed, falling back to legacy', {
        source: 'discord',
        messageId: message.id,
        error: error.message
      });
      
      // Fallback to legacy processing
      await this.processMessageLegacy(message);
    }
  }

  // Legacy message processing (unchanged, but extracted into separate method)
  async processMessageLegacy(message) {
    try {
      logger.debug('Processing message with legacy system', {
        source: 'discord',
        messageId: message.id,
        author: message.author?.username
      });

      // Image processing (unchanged)
      let imageAnalysis = null;
      if (message.attachments?.size > 0) {
        try {
          const llmSettings = storage.getLLMSettings();
          if (llmSettings.enable_image_analysis) {
            imageAnalysis = await this.imageProcessor.analyzeMessageImages(message);
            logger.info('Images processed', {
              source: 'image_processing',
              imageCount: imageAnalysis.length,
              hasVisionConfig: !!llmSettings.image_provider,
              hasApiKey: !!llmSettings.image_api_key,
              hasModel: !!llmSettings.image_model
            });
          }
        } catch (error) {
          logger.error('Image processing failed', {
            source: 'image_processing',
            error: error.message,
            hasVisionConfig: !!llmSettings.image_provider,
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
        await this.handleProcessedMessageLegacy(batchedMessage, imageAnalysis);
      });

    } catch (error) {
      logger.error('Error in legacy processMessage', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message?.id || 'unknown',
        author: message?.author?.username || 'Unknown'
      });
    }
  }

  // Legacy message handling (unchanged)
  async handleProcessedMessageLegacy(message, imageAnalysis) {
    try {
      // DEFENSIVE: Ensure message exists
      if (!message) {
        logger.warn('handleProcessedMessageLegacy called with null message', { source: 'discord' });
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
        discordClient: this.discordClient,
        hasImages: !!(imageAnalysis && imageAnalysis.length > 0),
        hasEmbeds: !!(message.embeds && message.embeds.length > 0),
        embedCount: message.embeds ? message.embeds.length : 0,
        isTriggered: false
      };

      // Make decision using legacy decision engine
      const decision = await this.decisionEngine.makeDecision(context);

      // DEFENSIVE: Ensure decision exists
      if (!decision) {
        logger.warn('Legacy decision engine returned null decision', {
          source: 'discord',
          messageId: message.id
        });
        return;
      }

      logger.info('Legacy decision made', {
        source: 'discord',
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        channel: message.channel?.name || 'Unknown',
        hasChainMetadata: !!decision.chainMetadata,
        toolsUsed: decision.chainMetadata ? decision.chainMetadata.toolActionCount : 0
      });

      // Execute the final decision (only non-tool actions reach ActionExecutor)
      if (!this.isToolAction(decision.action)) {
        await this.actionExecutor.executeAction(decision, message);
      } else {
        logger.warn('Tool action reached ActionExecutor in legacy mode', {
          source: 'discord',
          action: decision.action,
          messageId: message.id
        });
      }

    } catch (error) {
      logger.error('Error processing legacy message', {
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

  // NEW: Toggle plugin system at runtime
  async enablePluginSystem() {
    if (this.usePluginSystem && this.pluginSystemInitialized) {
      logger.info('Plugin system already enabled', { source: 'discord' });
      return { success: true, message: 'Already enabled' };
    }

    this.usePluginSystem = true;
    await this.initializePluginSystem();

    return {
      success: this.pluginSystemInitialized,
      message: this.pluginSystemInitialized ? 'Plugin system enabled' : 'Failed to enable plugin system'
    };
  }

  disablePluginSystem() {
    this.usePluginSystem = false;
    logger.info('Plugin system disabled, using legacy system', { source: 'discord' });
    return { success: true, message: 'Plugin system disabled' };
  }

  // Enhanced stats including plugin system
  getStats() {
    const baseStats = {
      messageProcessor: {
        usingPluginSystem: this.usePluginSystem && this.pluginSystemInitialized,
        pluginSystemInitialized: this.pluginSystemInitialized,
        legacyModeActive: !this.usePluginSystem || !this.pluginSystemInitialized
      },
      decisionEngine: this.decisionEngine.getDecisionStats(),
      toolSystem: this.decisionEngine.getToolStats()
    };

    // Add plugin system stats if available
    if (this.usePluginSystem && this.pluginSystemInitialized) {
      baseStats.pluginSystem = PluginSystem.getStatus();
    }

    return baseStats;
  }

  // Enhanced tool management
  getAvailableTools() {
    const tools = {
      legacy: this.decisionEngine.getAvailableTools()
    };

    if (this.usePluginSystem && this.pluginSystemInitialized) {
      tools.plugins = PluginSystem.getStatus().configuredPlugins;
    }

    return tools;
  }

  getToolStats() {
    const stats = {
      legacy: this.decisionEngine.getToolStats()
    };

    if (this.usePluginSystem && this.pluginSystemInitialized) {
      stats.plugins = PluginSystem.getStatus().pluginRegistry;
    }

    return stats;
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

  getDecisionEngine() {
    return this.decisionEngine;
  }

  getImageProcessor() {
    return this.imageProcessor;
  }

  getMessageBatcher() {
    return this.messageBatcher;
  }

  // NEW: Get plugin system (if available)
  getPluginSystem() {
    return this.usePluginSystem && this.pluginSystemInitialized ? PluginSystem : null;
  }
}

module.exports = MessageProcessor;