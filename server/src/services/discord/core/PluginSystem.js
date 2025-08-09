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
  async initialize(atlasDependencies = {}) {
    logger.info('Initializing Atlas plugin system', {
      source: 'plugin_system'
    });

    try {
      // Store Atlas dependencies
      this.storeDependencies(atlasDependencies);

      // Load all plugins
      const loadResults = await PluginLoader.loadAllPlugins(
        Object.fromEntries(this.dependencies)
      );

      // Initialize message pipeline with plugin support
      this.messagePipeline = new MessagePipeline(Object.fromEntries(this.dependencies));

      // Setup event listeners
      this.setupEventListeners();

      this.initialized = true;

      logger.success('Plugin system initialized successfully', {
        source: 'plugin_system',
        pluginsLoaded: loadResults.loaded,
        pluginsFailed: loadResults.failed
      });

      return {
        success: true,
        pluginsLoaded: loadResults.loaded,
        pluginsFailed: loadResults.failed,
        errors: loadResults.errors
      };

    } catch (error) {
      logger.error('Failed to initialize plugin system', {
        source: 'plugin_system',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
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
      // Add more as needed
    };

    // Filter out undefined dependencies
    Object.entries(coreDependencies).forEach(([name, dependency]) => {
      if (dependency !== undefined) {
        this.dependencies.set(name, dependency);
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