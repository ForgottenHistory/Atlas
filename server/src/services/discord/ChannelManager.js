const storage = require('../../utils/storage');

class ChannelManager {
  constructor(discordClient) {
    this.discordClient = discordClient;
    this.eventHandlers = new Map();
  }

  // Update active channels configuration
  async updateActiveChannels(serverId, channelIds) {
    try {
      await storage.init();

      // Get current config or create new one
      let channelsConfig = storage.get('activeChannels') || {};

      // Update server's active channels
      channelsConfig[serverId] = {
        channelIds: channelIds,
        updatedAt: new Date().toISOString()
      };

      // Save to storage
      const success = await storage.set('activeChannels', channelsConfig);

      if (success) {
        // Add activity log
        const client = this.discordClient.getClient();
        const guild = client?.guilds.cache.get(serverId);
        const serverName = guild ? guild.name : 'Unknown Server';
        await storage.addActivity(`Active channels updated for ${serverName} (${channelIds.length} channels)`);

        // Emit update event
        this.emit('activeChannelsUpdated', {
          serverId,
          channelIds,
          serverName
        });
      }

      return success;
    } catch (error) {
      console.error('Failed to update active channels:', error);
      return false;
    }
  }

  // Get active channels as a simple list (for plugin system)
  getActiveChannelsList() {
    const client = this.discordClient.getClient();
    if (!client || !this.discordClient.isReady()) {
      return [];
    }

    const channelsConfig = this.getAllActiveChannels();
    const result = [];

    for (const [serverId, config] of Object.entries(channelsConfig)) {
      const guild = client.guilds.cache.get(serverId);
      if (!guild) continue;

      // Add each active channel to the flat list
      for (const channelId of config.channelIds) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          result.push({
            id: channel.id,
            name: channel.name,
            serverId: serverId,
            serverName: guild.name,
            type: channel.type
          });
        }
      }
    }

    return result;
  }

  // Get active channels for a server
  getActiveChannels(serverId) {
    const channelsConfig = storage.get('activeChannels') || {};
    return channelsConfig[serverId]?.channelIds || [];
  }

  // Get all active channels configuration
  getAllActiveChannels() {
    return storage.get('activeChannels') || {};
  }

  // Check if a channel is active
  isChannelActive(channelId) {
    const channelsConfig = storage.get('activeChannels') || {};

    for (const serverConfig of Object.values(channelsConfig)) {
      if (serverConfig.channelIds && serverConfig.channelIds.includes(channelId)) {
        return true;
      }
    }

    return false;
  }

  // Remove server from active channels (when bot leaves server)
  async removeServerChannels(serverId) {
    try {
      const channelsConfig = storage.get('activeChannels') || {};

      if (channelsConfig[serverId]) {
        delete channelsConfig[serverId];
        await storage.set('activeChannels', channelsConfig);
        await storage.addActivity(`Removed channel configuration for server (bot left)`);
      }

      return true;
    } catch (error) {
      console.error('Failed to remove server channels:', error);
      return false;
    }
  }

  // Get active channels with server info
  getActiveChannelsWithInfo() {
    const client = this.discordClient.getClient();
    if (!client || !this.discordClient.isReady()) {
      return [];
    }

    const channelsConfig = this.getAllActiveChannels();
    const result = [];

    for (const [serverId, config] of Object.entries(channelsConfig)) {
      const guild = client.guilds.cache.get(serverId);
      if (!guild) continue;

      const channels = config.channelIds.map(channelId => {
        const channel = guild.channels.cache.get(channelId);
        return channel ? {
          id: channel.id,
          name: channel.name,
          type: channel.type
        } : null;
      }).filter(Boolean);

      result.push({
        serverId,
        serverName: guild.name,
        channels,
        updatedAt: config.updatedAt
      });
    }

    return result;
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
        console.error(`Error in channel manager event handler for ${event}:`, error);
      }
    });
  }
}

module.exports = ChannelManager;