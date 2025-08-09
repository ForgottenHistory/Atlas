const MessageProcessor = require('./message/MessageProcessor');
const MessageListener = require('./message/MessageListener');
const MessageStats = require('./message/MessageStats');
const logger = require('../logger/Logger');

class MessageHandler {
  constructor(discordClient, channelManager, options = {}) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    
    // NEW: Plugin system configuration
    this.options = {
      usePluginSystem: options.usePluginSystem !== false, // Default to true
      ...options
    };
    
    // Initialize specialized services
    this.processor = new MessageProcessor(discordClient, channelManager, {
      usePluginSystem: this.options.usePluginSystem
    });
    this.listener = new MessageListener();
    this.stats = new MessageStats(this.processor);
    
    this.setupMessageListener();
    
    logger.info('MessageHandler initialized with autonomous decision making and image processing', { 
      source: 'discord',
      services: ['MessageProcessor', 'MessageListener', 'MessageStats'],
      usingPluginSystem: this.options.usePluginSystem
    });
  }

  setupMessageListener() {
    const client = this.discordClient.getClient();
    if (!client) return;

    this.listener.setupListener(client, this.handleMessage.bind(this), (message) => {
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
      if (message.author.bot) return;
      
      await this.processor.processMessage(message);
      
    } catch (error) {
      logger.error('Error in message handler', {
        source: 'discord',
        error: error.message,
        author: message.author?.username || 'Unknown',
        channel: message.channel?.name || 'Unknown',
        usingPluginSystem: this.options.usePluginSystem
      });
    }
  }

  // NEW: Plugin system management methods
  async enablePluginSystem() {
    this.options.usePluginSystem = true;
    const result = await this.processor.enablePluginSystem();
    
    logger.info('Plugin system toggle requested', {
      source: 'discord',
      success: result.success,
      message: result.message
    });
    
    return result;
  }

  disablePluginSystem() {
    this.options.usePluginSystem = false;
    const result = this.processor.disablePluginSystem();
    
    logger.info('Plugin system disabled', {
      source: 'discord',
      message: result.message
    });
    
    return result;
  }

  isUsingPluginSystem() {
    return this.options.usePluginSystem && this.processor.pluginSystemInitialized;
  }

  // NEW: Get plugin system status
  getPluginSystemStatus() {
    return {
      enabled: this.options.usePluginSystem,
      initialized: this.processor.pluginSystemInitialized,
      active: this.isUsingPluginSystem(),
      stats: this.processor.getPluginSystem()?.getStatus() || null
    };
  }

  // Public API - delegate to appropriate services
  getConversationHistory(channelId) {
    return this.processor.getConversationHistory(channelId);
  }

  clearConversationHistory(channelId) {
    return this.processor.clearConversationHistory(channelId);
  }

  getMemoryStats(channelId) {
    return this.processor.getMemoryStats(channelId);
  }

  getBatchStats() {
    return this.stats.getBatchStats();
  }

  getQueueStats() {
    return this.stats.getQueueStats();
  }

  getQueueHealth() {
    return this.stats.getQueueHealth();
  }

  getDecisionStats() {
    return this.stats.getDecisionStats();
  }

  getImageProcessingStats() {
    return this.stats.getImageProcessingStats();
  }

  // NEW: Enhanced stats with plugin system info
  getComprehensiveStats() {
    const baseStats = this.stats.getComprehensiveStats();
    
    // Add plugin system information
    baseStats.pluginSystem = this.getPluginSystemStatus();
    
    // Add processor stats (includes plugin system stats)
    baseStats.processor = this.processor.getStats();
    
    return baseStats;
  }

  // NEW: Get available tools (both legacy and plugin)
  getAvailableTools() {
    return this.processor.getAvailableTools();
  }

  // NEW: Get tool statistics (both legacy and plugin)
  getToolStats() {
    return this.processor.getToolStats();
  }

  // Event system methods
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