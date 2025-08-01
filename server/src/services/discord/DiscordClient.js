const { Client, GatewayIntentBits, Events } = require('discord.js');
const storage = require('../../utils/storage');

class DiscordClient {
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

      this.setupCoreEventHandlers();
      
      await this.client.login(settings.botToken);
      return true;
    } catch (error) {
      console.error('Failed to initialize Discord client:', error);
      this.isConnected = false;
      return false;
    }
  }

  setupCoreEventHandlers() {
    if (!this.client) return;

    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`Discord bot logged in as ${readyClient.user.tag}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Update activity log
      await storage.addActivity(`Bot connected as ${readyClient.user.tag}`);
      
      // Emit to external listeners
      this.emit('botConnected', {
        username: readyClient.user.tag,
        id: readyClient.user.id,
        guilds: readyClient.guilds.cache.size
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
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  // Getters
  getClient() {
    return this.client;
  }

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

module.exports = DiscordClient;