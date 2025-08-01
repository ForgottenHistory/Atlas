const storage = require('../../utils/storage');

class ServerManager {
  constructor(discordClient) {
    this.discordClient = discordClient;
  }

  // Get servers (guilds) that the bot is in
  getServers() {
    const client = this.discordClient.getClient();
    if (!client || !this.discordClient.isReady()) {
      return [];
    }

    return client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      iconURL: guild.iconURL(),
      owner: guild.ownerId === client.user.id
    }));
  }

  // Get channels for a specific server
  getChannels(serverId) {
    const client = this.discordClient.getClient();
    if (!client || !this.discordClient.isReady()) {
      return [];
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return [];
    }

    return guild.channels.cache
      .filter(channel => 
        channel.type !== 4 && // Exclude category channels
        channel.type !== 2    // Exclude voice channels
      )
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: this.getChannelTypeString(channel.type),
        topic: channel.topic || null,
        parentId: channel.parentId,
        position: channel.position,
        nsfw: channel.nsfw || false
      }))
      .sort((a, b) => a.position - b.position);
  }

  // Helper to convert Discord channel types to readable strings
  getChannelTypeString(type) {
    const types = {
      0: 'GUILD_TEXT',
      1: 'DM',
      2: 'GUILD_VOICE',
      3: 'GROUP_DM',
      4: 'GUILD_CATEGORY',
      5: 'GUILD_ANNOUNCEMENT',
      10: 'ANNOUNCEMENT_THREAD',
      11: 'PUBLIC_THREAD',
      12: 'PRIVATE_THREAD',
      13: 'GUILD_STAGE_VOICE',
      14: 'GUILD_DIRECTORY',
      15: 'GUILD_FORUM'
    };
    return types[type] || 'UNKNOWN';
  }

  // Get server info by ID
  getServerInfo(serverId) {
    const client = this.discordClient.getClient();
    if (!client || !this.discordClient.isReady()) {
      return null;
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return null;
    }

    return {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      iconURL: guild.iconURL(),
      owner: guild.ownerId === client.user.id,
      createdAt: guild.createdAt,
      description: guild.description,
      features: guild.features
    };
  }

  // Get channel info by ID
  getChannelInfo(channelId) {
    const client = this.discordClient.getClient();
    if (!client || !this.discordClient.isReady()) {
      return null;
    }

    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      return null;
    }

    return {
      id: channel.id,
      name: channel.name,
      type: this.getChannelTypeString(channel.type),
      topic: channel.topic || null,
      guild: channel.guild ? {
        id: channel.guild.id,
        name: channel.guild.name
      } : null
    };
  }
}

module.exports = ServerManager;