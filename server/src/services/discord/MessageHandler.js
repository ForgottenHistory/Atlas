const storage = require('../../utils/storage');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    this.setupMessageListener();
  }

  setupMessageListener() {
    const client = this.discordClient.getClient();
    if (!client) return;

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      await this.handleMessage(message);
      
      // Emit message received event
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
      // Skip bot messages
      if (message.author.bot) return;
      
      // Check if this channel is active
      if (!this.channelManager.isChannelActive(message.channel.id)) {
        return; // Don't respond in inactive channels
      }
      
      const settings = storage.getSettings();
      const persona = storage.getPersona();
      const prefix = settings.commandPrefix || '!';

      // Simple "Hi" response for any non-command message
      if (!message.content.startsWith(prefix)) {
        await this.handleRegularMessage(message);
        return;
      }

      // Handle commands
      await this.handleCommand(message, prefix);
      
    } catch (error) {
      console.error('Error handling message:', error);
      await message.reply('Sorry, something went wrong processing that message.').catch(() => {});
    }
  }

  async handleRegularMessage(message) {
    // Respond with "Hi" to any regular message in active channels
    await message.reply('Hi! 👋');
  }

  async handleCommand(message, prefix) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
      case 'ping':
        await this.handlePingCommand(message);
        break;
        
      case 'help':
        await this.handleHelpCommand(message, prefix);
        break;
        
      case 'info':
        await this.handleInfoCommand(message);
        break;
        
      default:
        await this.handleUnknownCommand(message, command);
        break;
    }

    // Log activity
    await storage.addActivity(`Command executed: ${prefix}${command} by ${message.author.username} in #${message.channel.name}`);
  }

  async handlePingCommand(message) {
    const sent = await message.reply('Pinging...');
    const timeDiff = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit(`Pong! 🏓 Latency: ${timeDiff}ms`);
  }

  async handleHelpCommand(message, prefix) {
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
  }

  async handleInfoCommand(message) {
    const client = this.discordClient.getClient();
    const persona = storage.getPersona();
    
    const infoEmbed = {
      color: 0x00FF00,
      title: persona.name || 'Atlas Bot',
      description: persona.description || 'A Discord bot powered by Atlas Dashboard',
      fields: [
        { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
        { name: 'Users', value: client.users.cache.size.toString(), inline: true },
        { name: 'Uptime', value: this.formatUptime(client.uptime), inline: true }
      ],
      timestamp: new Date().toISOString()
    };
    await message.reply({ embeds: [infoEmbed] });
  }

  async handleUnknownCommand(message, command) {
    const persona = storage.getPersona();
    
    if (persona.name && persona.description) {
      await message.reply(`I'm ${persona.name}! ${persona.description.slice(0, 100)}...`);
    } else {
      await message.reply("I don't recognize that command. Try `!help` for available commands.");
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
        console.error(`Error in message handler event for ${event}:`, error);
      }
    });
  }
}

module.exports = MessageHandler;