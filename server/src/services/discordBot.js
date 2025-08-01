const { Client, GatewayIntentBits, Events } = require('discord.js');
const storage = require('../utils/storage');

class DiscordBot {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.eventHandlers = new Map();
  }

  async initialize() {
    try {
      await storage.init();
      const settings = storage.getSettings();
      
      if (!settings.botToken) {
        console.log('No bot token found. Bot will remain offline.');
        return false;
      }

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers
        ]
      });

      this.setupEventHandlers();
      
      await this.client.login(settings.botToken);
      return true;
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error);
      this.isConnected = false;
      return false;
    }
  }

  setupEventHandlers() {
    if (!this.client) return;

    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`Discord bot logged in as ${readyClient.user.tag}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Update activity log
      await storage.addActivity(`Bot connected as ${readyClient.user.tag}`);
      
      // Emit to socket clients
      this.emit('botConnected', {
        username: readyClient.user.tag,
        id: readyClient.user.id,
        guilds: readyClient.guilds.cache.size
      });
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      
      await this.handleMessage(message);
      
      // Update stats
      this.emit('messageReceived', {
        author: message.author.username,
        content: message.content,
        guild: message.guild?.name || 'DM',
        channel: message.channel.name || 'DM'
      });
    });

    this.client.on(Events.Error, (error) => {
      console.error('Discord client error:', error);
      this.emit('botError', { error: error.message });
    });

    this.client.on(Events.Disconnect, () => {
      console.log('Discord bot disconnected');
      this.isConnected = false;
      this.emit('botDisconnected');
      this.attemptReconnect();
    });

    this.client.on(Events.ShardError, (error) => {
      console.error('Discord shard error:', error);
      this.emit('botError', { error: error.message });
    });
  }

  async handleMessage(message) {
    try {
      // Skip bot messages
      if (message.author.bot) return;
      
      // Check if this channel is active
      if (!this.isChannelActive(message.channel.id)) {
        return; // Don't respond in inactive channels
      }
      
      const settings = storage.getSettings();
      const persona = storage.getPersona();
      const prefix = settings.commandPrefix || '!';

      // Simple "Hi" response for any non-command message
      if (!message.content.startsWith(prefix)) {
        // Respond with "Hi" to any regular message in active channels
        await message.reply('Hi! 👋');
        return;
      }

      // Handle commands
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();

      switch (command) {
        case 'ping':
          await message.reply('Pong! 🏓');
          break;
          
        case 'help':
          const helpEmbed = {
            color: 0x0099FF,
            title: '🤖 Bot Commands',
            fields: [
              { name: `${prefix}ping`, value: 'Check bot response time', inline: true },
              { name: `${prefix}help`, value: 'Show this help message', inline: true },
              { name: `${prefix}info`, value: 'Show bot information', inline: true }
            ],
            timestamp: new Date().toISOString()
          };
          await message.reply({ embeds: [helpEmbed] });
          break;
          
        case 'info':
          const infoEmbed = {
            color: 0x00FF00,
            title: persona.name || 'Atlas Bot',
            description: persona.description || 'A Discord bot powered by Atlas Dashboard',
            fields: [
              { name: 'Servers', value: this.client.guilds.cache.size.toString(), inline: true },
              { name: 'Users', value: this.client.users.cache.size.toString(), inline: true },
              { name: 'Uptime', value: this.formatUptime(this.client.uptime), inline: true }
            ],
            timestamp: new Date().toISOString()
          };
          await message.reply({ embeds: [infoEmbed] });
          break;
          
        default:
          // Handle unknown commands or custom persona responses
          if (persona.name && persona.description) {
            await message.reply(`I'm ${persona.name}! ${persona.description.slice(0, 100)}...`);
          } else {
            await message.reply("I don't recognize that command. Try `!help` for available commands.");
          }
          break;
      }

      // Log activity
      await storage.addActivity(`Command executed: ${prefix}${command} by ${message.author.username} in #${message.channel.name}`);
      
    } catch (error) {
      console.error('Error handling message:', error);
      await message.reply('Sorry, something went wrong processing that message.').catch(() => {});
    }
  }

  formatUptime(uptime) {
    const seconds = Math.floor((uptime / 1000) % 60);
    const minutes = Math.floor((uptime / (1000 * 60)) % 60);
    const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      await storage.addActivity('Bot connection failed - max retries reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, this.reconnectDelay);
  }

  async disconnect() {
    if (this.client) {
      this.isConnected = false;
      await this.client.destroy();
      this.client = null;
      console.log('Discord bot disconnected');
      await storage.addActivity('Bot manually disconnected');
    }
  }

  async updateToken(newToken) {
    await this.disconnect();
    
    if (newToken && newToken.trim()) {
      return await this.initialize();
    }
    
    return false;
  }

  // Event system for socket.io integration
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
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  // Get servers (guilds) that the bot is in
  getServers() {
    if (!this.client || !this.isConnected) {
      return [];
    }

    return this.client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      iconURL: guild.iconURL(),
      owner: guild.ownerId === this.client.user.id
    }));
  }

  // Get channels for a specific server
  getChannels(serverId) {
    if (!this.client || !this.isConnected) {
      return [];
    }

    const guild = this.client.guilds.cache.get(serverId);
    if (!guild) {
      return [];
    }

    return guild.channels.cache
      .filter(channel => channel.type !== 4) // Exclude category channels for now
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: this.getChannelTypeString(channel.type),
        topic: channel.topic || null,
        parentId: channel.parentId,
        position: channel.position,
        memberCount: channel.type === 2 ? channel.members?.size : null, // Voice channels
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
        const guild = this.client?.guilds.cache.get(serverId);
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

  // Get active channels for a server
  getActiveChannels(serverId) {
    const channelsConfig = storage.get('activeChannels') || {};
    return channelsConfig[serverId]?.channelIds || [];
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

  // Getters
  getStatus() {
    return {
      isConnected: this.isConnected,
      username: this.client?.user?.tag || null,
      guilds: this.client?.guilds?.cache.size || 0,
      users: this.client?.users?.cache.size || 0,
      uptime: this.client?.uptime || 0
    };
  }

  isReady() {
    return this.client && this.isConnected;
  }
}

// Create singleton instance
const discordBot = new DiscordBot();

module.exports = discordBot;