const DiscordClient = require('./DiscordClient');
const ServerManager = require('./ServerManager');
const ChannelManager = require('./ChannelManager');
const MessageHandler = require('./MessageHandler');
const logger = require('../logger/Logger');

class DiscordService {
  constructor(options = {}) {
    this.client = new DiscordClient();
    this.serverManager = new ServerManager(this.client);
    this.channelManager = new ChannelManager(this.client);
    this.messageHandler = null; // Will be initialized after client connects
    
    // Initialize event handlers map (REQUIRED for event system)
    this.eventHandlers = new Map();
    
    // NEW: Plugin system configuration
    this.options = {
      usePluginSystem: options.usePluginSystem !== false, // Default to true
      ...options
    };
    
    this.setupEventHandlers();
    
    logger.info('DiscordService initialized', {
      source: 'discord',
      pluginSystemEnabled: this.options.usePluginSystem
    });
  }

  setupEventHandlers() {
    // Forward client events
    this.client.on('botConnected', (data) => {
      // Initialize message handler after connection with plugin system options
      this.messageHandler = new MessageHandler(this.client, this.channelManager, {
        usePluginSystem: this.options.usePluginSystem
      });
      
      // Forward message events
      this.messageHandler.on('messageReceived', (data) => {
        this.emit('messageReceived', data);
      });
      
      logger.success('MessageHandler initialized with plugin system support', {
        source: 'discord',
        usingPluginSystem: this.options.usePluginSystem
      });
      
      this.emit('botConnected', data);
    });

    this.client.on('botDisconnected', () => {
      this.messageHandler = null;
      this.emit('botDisconnected');
    });

    this.client.on('botError', (data) => {
      this.emit('botError', data);
    });

    // Forward channel manager events
    this.channelManager.on('activeChannelsUpdated', (data) => {
      this.emit('activeChannelsUpdated', data);
    });
  }

  // Client methods (unchanged)
  async initialize() {
    return await this.client.initialize();
  }

  async disconnect() {
    this.messageHandler = null;
    return await this.client.disconnect();
  }

  async updateToken(newToken) {
    return await this.client.updateToken(newToken);
  }

  getStatus() {
    const baseStatus = this.client.getStatus();
    
    // NEW: Add plugin system status
    if (this.messageHandler) {
      baseStatus.pluginSystem = this.messageHandler.getPluginSystemStatus();
    }
    
    return baseStatus;
  }

  isReady() {
    return this.client.isReady();
  }

  // Server methods (unchanged)
  getServers() {
    return this.serverManager.getServers();
  }

  getChannels(serverId) {
    return this.serverManager.getChannels(serverId);
  }

  getServerInfo(serverId) {
    return this.serverManager.getServerInfo(serverId);
  }

  getChannelInfo(channelId) {
    return this.serverManager.getChannelInfo(channelId);
  }

  // Channel management methods (unchanged)
  async updateActiveChannels(serverId, channelIds) {
    return await this.channelManager.updateActiveChannels(serverId, channelIds);
  }

  getActiveChannels() {
    return this.channelManager.getActiveChannels();
  }

  getActiveChannelsList() {
    return this.channelManager.getActiveChannelsList();
  }

  getActiveChannels() {
    return this.channelManager.getActiveChannels();
  }

  getActiveChannelsList() {
    return this.channelManager.getActiveChannelsList();
  }

  // Message handling methods (unchanged)
  getConversationHistory(channelId) {
    return this.messageHandler?.getConversationHistory(channelId) || [];
  }

  clearConversationHistory(channelId) {
    return this.messageHandler?.clearConversationHistory(channelId) || false;
  }

  getMemoryStats(channelId) {
    return this.messageHandler?.getMemoryStats(channelId) || null;
  }

  getBatchStats() {
    return this.messageHandler?.getBatchStats() || null;
  }

  getQueueStats() {
    return this.messageHandler?.getQueueStats() || null;
  }

  getQueueHealth() {
    return this.messageHandler?.getQueueHealth() || null;
  }

  getDecisionStats() {
    return this.messageHandler?.getDecisionStats() || null;
  }

  getImageProcessingStats() {
    return this.messageHandler?.getImageProcessingStats() || null;
  }

  // NEW: Plugin system management methods
  
  /**
   * Enable the plugin system at runtime
   */
  async enablePluginSystem() {
    if (!this.messageHandler) {
      this.options.usePluginSystem = true;
      return { 
        success: false, 
        message: 'Bot not connected. Plugin system will be enabled on next connection.',
        deferred: true
      };
    }

    try {
      const result = await this.messageHandler.enablePluginSystem();
      if (result.success) {
        this.options.usePluginSystem = true;
      }
      return result;
    } catch (error) {
      logger.error('Failed to enable plugin system', {
        source: 'discord',
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Disable the plugin system and use legacy mode
   */
  disablePluginSystem() {
    this.options.usePluginSystem = false;
    
    if (!this.messageHandler) {
      return { 
        success: true, 
        message: 'Plugin system will be disabled on next connection.' 
      };
    }

    try {
      return this.messageHandler.disablePluginSystem();
    } catch (error) {
      logger.error('Failed to disable plugin system', {
        source: 'discord',
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Check if plugin system is currently active
   */
  isUsingPluginSystem() {
    return this.messageHandler?.isUsingPluginSystem() || false;
  }

  /**
   * Get comprehensive plugin system status
   */
  getPluginSystemStatus() {
    if (!this.messageHandler) {
      return {
        enabled: this.options.usePluginSystem,
        initialized: false,
        active: false,
        message: 'Bot not connected'
      };
    }

    return this.messageHandler.getPluginSystemStatus();
  }

  /**
   * Get available tools (both legacy and plugin-based)
   */
  getAvailableTools() {
    if (!this.messageHandler) {
      return { legacy: [], plugins: [] };
    }

    return this.messageHandler.getAvailableTools();
  }

  /**
   * Get tool statistics
   */
  getToolStats() {
    if (!this.messageHandler) {
      return { legacy: {}, plugins: {} };
    }

    return this.messageHandler.getToolStats();
  }

  /**
   * Get comprehensive stats including plugin system
   */
  getComprehensiveStats() {
    if (!this.messageHandler) {
      return {
        connected: false,
        pluginSystem: this.getPluginSystemStatus()
      };
    }

    return this.messageHandler.getComprehensiveStats();
  }

  // Event system methods (REQUIRED - fix for socketEventManager)
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
        logger.error('Error in discord service event', {
          source: 'discord',
          event: event,
          error: error.message
        });
      }
    });
  }

  // Get remaining methods (unchanged)
  getActiveChannels() {
    return this.channelManager.getActiveChannels();
  }

  getActiveChannelsList() {
    return this.channelManager.getActiveChannelsList();
  }
}

module.exports = new DiscordService();