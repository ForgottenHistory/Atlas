const DiscordClient = require('./DiscordClient');
const ServerManager = require('./ServerManager');
const ChannelManager = require('./ChannelManager');
const MessageHandler = require('./MessageHandler');

class DiscordService {
  constructor() {
    this.client = new DiscordClient();
    this.serverManager = new ServerManager(this.client);
    this.channelManager = new ChannelManager(this.client);
    this.messageHandler = null; // Will be initialized after client connects
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Forward client events
    this.client.on('botConnected', (data) => {
      // Initialize message handler after connection
      this.messageHandler = new MessageHandler(this.client, this.channelManager);
      
      // Forward message events
      this.messageHandler.on('messageReceived', (data) => {
        this.emit('messageReceived', data);
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

  // Client methods
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
    return this.client.getStatus();
  }

  isReady() {
    return this.client.isReady();
  }

  // Server methods
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

  // Channel management methods
  async updateActiveChannels(serverId, channelIds) {
    return await this.channelManager.updateActiveChannels(serverId, channelIds);
  }

  getActiveChannels(serverId) {
    return this.channelManager.getActiveChannels(serverId);
  }

  getAllActiveChannels() {
    return this.channelManager.getAllActiveChannels();
  }

  isChannelActive(channelId) {
    return this.channelManager.isChannelActive(channelId);
  }

  getActiveChannelsWithInfo() {
    return this.channelManager.getActiveChannelsWithInfo();
  }

  async removeServerChannels(serverId) {
    return await this.channelManager.removeServerChannels(serverId);
  }

  // Event system for external listeners
  eventHandlers = new Map();

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
        console.error(`Error in discord service event handler for ${event}:`, error);
      }
    });
  }
}

// Create singleton instance
const discordService = new DiscordService();

module.exports = discordService;