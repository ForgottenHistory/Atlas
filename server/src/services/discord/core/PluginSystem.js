const PluginLoader = require('./PluginLoader');
const PluginRegistry = require('./PluginRegistry');
const EventBus = require('./EventBus');
const MessagePipeline = require('./MessagePipeline');
const PluginConfiguration = require('../plugins/PluginConfiguration');
const logger = require('../../logger/Logger');

/**
 * Plugin system integration with Atlas
 * Coordinates plugin loading and integration with existing services
 */
class PluginSystem {

  constructor() {
    this.initialized = false;
    this.messagePipeline = null;
    this.dependencies = new Map();
  }

  /**
     * Initialize the plugin system with Atlas dependencies
     */
  async initialize(dependencies = {}) {
    try {
      logger.info('Initializing plugin system with Atlas dependencies', {
        source: 'plugin_system',
        dependencies: Object.keys(dependencies)
      });

      // Store dependencies for plugin injection
      this.dependencies = new Map(Object.entries(dependencies));

      // NOTE: PluginRegistry and EventBus are singletons, no initialize() needed
      // They're ready to use immediately

      // Load plugins with dependencies
      const loadResult = await PluginLoader.loadAllPlugins(dependencies);

      if (loadResult.failed > 0) {
        logger.warn('Some plugins failed to load', {
          source: 'plugin_system',
          failed: loadResult.failed,
          loaded: loadResult.loaded,
          errors: loadResult.errors
        });
      }

      // Initialize message pipeline with dependencies
      this.messagePipeline = new MessagePipeline(dependencies);

      // Initialize decision pipeline
      const DecisionPipeline = require('./DecisionPipeline');
      this.decisionPipeline = new DecisionPipeline(dependencies);

      // NEW: Load conversation history for active channels
      await this.loadConversationHistory(dependencies);

      this.initialized = true;

      logger.success('Plugin system initialized successfully', {
        source: 'plugin_system',
        pluginsLoaded: loadResult.loaded,
        pluginsFailed: loadResult.failed,
        dependenciesCount: this.dependencies.size
      });

      return {
        success: true,
        pluginsLoaded: loadResult.loaded,
        pluginsFailed: loadResult.failed
      };

    } catch (error) {
      logger.error('Failed to initialize plugin system', {
        source: 'plugin_system',
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * NEW: Load conversation history for active channels on startup
   */
  async loadConversationHistory(dependencies) {
    try {
      const { discordClient, conversationManager, channelManager, messageFilter } = dependencies;

      if (!discordClient || !conversationManager || !channelManager) {
        logger.warn('Missing dependencies for conversation history loading', {
          source: 'plugin_system',
          hasDiscordClient: !!discordClient,
          hasConversationManager: !!conversationManager,
          hasChannelManager: !!channelManager
        });
        return;
      }

      // Import ConversationHistoryLoader
      const ConversationHistoryLoader = require('../conversation/ConversationHistoryLoader');

      // Initialize history loader
      const historyLoader = new ConversationHistoryLoader(discordClient, messageFilter);

      // Get active channels
      const activeChannels = channelManager.getActiveChannelsList();

      if (activeChannels.length === 0) {
        logger.info('No active channels for conversation history loading', {
          source: 'plugin_system'
        });
        return;
      }

      logger.info('Loading conversation history for active channels', {
        source: 'plugin_system',
        channelCount: activeChannels.length
      });

      // Load history for each active channel
      let successCount = 0;
      for (const channel of activeChannels) {
        try {
          const loaded = await historyLoader.loadRecentHistory(channel.id, conversationManager);
          if (loaded) {
            successCount++;
            logger.debug('Loaded conversation history', {
              source: 'plugin_system',
              channelId: channel.id,
              channelName: channel.name
            });
          }
        } catch (error) {
          logger.warn('Failed to load history for channel', {
            source: 'plugin_system',
            channelId: channel.id,
            channelName: channel.name,
            error: error.message
          });
        }
      }

      logger.success('Conversation history loading completed', {
        source: 'plugin_system',
        totalChannels: activeChannels.length,
        successfullyLoaded: successCount
      });

    } catch (error) {
      logger.error('Conversation history loading failed', {
        source: 'plugin_system',
        error: error.message
      });
      // Don't fail initialization if history loading fails
    }
  }

  /**
   * Process a Discord message through the plugin-enabled pipeline
   */
  async processMessage(discordMessage) {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    return await this.messagePipeline.processMessage(discordMessage);
  }

  /**
   * Add a new dependency (hot-add support)
   */
  addDependency(name, dependency) {
    this.dependencies.set(name, dependency);
    PluginLoader.addDependency(name, dependency);

    // Update message pipeline dependencies
    if (this.messagePipeline) {
      this.messagePipeline.updateDependencies({ [name]: dependency });
    }

    logger.info('Dependency added to plugin system', {
      source: 'plugin_system',
      dependencyName: name
    });
  }

  /**
   * Hot-reload a specific plugin
   */
  async reloadPlugin(pluginName) {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      await PluginLoader.reloadPlugin(pluginName);

      logger.success('Plugin reloaded successfully', {
        source: 'plugin_system',
        pluginName
      });

      return { success: true };
    } catch (error) {
      logger.error('Plugin reload failed', {
        source: 'plugin_system',
        pluginName,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Get system status and statistics
   */
  getStatus() {
    return {
      initialized: this.initialized,
      pluginLoader: PluginLoader.getLoadStatus(),
      pluginRegistry: PluginRegistry.getStats(),
      messagePipeline: this.messagePipeline?.getStats() || null,
      availableDependencies: Array.from(this.dependencies.keys()),
      configuredPlugins: Object.keys(PluginConfiguration.getPluginDefinitions())
    };
  }

  /**
   * Get plugin documentation
   */
  getPluginDocs() {
    return PluginConfiguration.generatePluginDocs();
  }

  /**
   * Execute a specific tool manually (for testing/debugging)
   */
  async executeToolManually(toolName, context) {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      const result = await PluginRegistry.executeTool(
        toolName,
        context,
        Object.fromEntries(this.dependencies)
      );

      logger.debug('Manual tool execution completed', {
        source: 'plugin_system',
        toolName,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error('Manual tool execution failed', {
        source: 'plugin_system',
        toolName,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Execute a specific action manually (for testing/debugging)
   */
  async executeActionManually(actionName, context) {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      const result = await PluginRegistry.executeAction(
        actionName,
        context,
        Object.fromEntries(this.dependencies)
      );

      logger.debug('Manual action execution completed', {
        source: 'plugin_system',
        actionName,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error('Manual action execution failed', {
        source: 'plugin_system',
        actionName,
        error: error.message
      });

      throw error;
    }
  }

  // === PRIVATE METHODS ===

  /**
   * Store Atlas dependencies for plugin use
   */
  storeDependencies(atlasDependencies) {
    // Core Atlas services that plugins will need
    const coreDependencies = {
      discordClient: atlasDependencies.discordClient,
      llmService: atlasDependencies.llmService,
      conversationManager: atlasDependencies.conversationManager,
      responseGenerator: atlasDependencies.responseGenerator,
      messageFilter: atlasDependencies.messageFilter,
      actionExecutor: atlasDependencies.actionExecutor,
      channelManager: atlasDependencies.channelManager,
      // Add more as needed
    };

    // Filter out undefined dependencies and store them
    Object.entries(coreDependencies).forEach(([name, dependency]) => {
      if (dependency !== undefined && dependency !== null) {
        this.dependencies.set(name, dependency);
      } else {
        logger.warn('Dependency is null/undefined, skipping', {
          source: 'plugin_system',
          dependencyName: name
        });
      }
    });

    logger.debug('Dependencies stored for plugin system', {
      source: 'plugin_system',
      dependencyCount: this.dependencies.size,
      dependencies: Array.from(this.dependencies.keys())
    });
  }

  /**
   * Setup event listeners for plugin system events
   */
  setupEventListeners() {
    // Listen for plugin execution events
    EventBus.subscribe('plugin:executed', (eventData) => {
      logger.debug('Plugin executed', {
        source: 'plugin_system',
        pluginName: eventData.data.pluginName,
        success: eventData.data.result?.success
      });
    });

    // Listen for system errors
    EventBus.subscribe('system:error', (eventData) => {
      logger.warn('System error detected', {
        source: 'plugin_system',
        error: eventData.data.error,
        context: eventData.data.context
      });
    });

    // Listen for message processing events
    EventBus.subscribe('message:processed', (eventData) => {
      logger.debug('Message processed through plugin system', {
        source: 'plugin_system',
        messageId: eventData.data.message?.id,
        action: eventData.data.decision?.action,
        processingTime: eventData.data.processingTime
      });
    });

    logger.debug('Event listeners setup for plugin system', {
      source: 'plugin_system'
    });
  }
}

// Export singleton instance
module.exports = new PluginSystem();