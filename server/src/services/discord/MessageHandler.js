const storage = require('../../utils/storage');
const LLMService = require('../llm');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    this.llmService = new LLMService();
    this.conversationHistory = new Map(); // channelId -> messages array
    this.maxHistoryPerChannel = 20;
    
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
      const prefix = settings.commandPrefix || '!';

      // Handle commands first
      if (message.content.startsWith(prefix)) {
        await this.handleCommand(message, prefix);
        return;
      }

      // Store message in conversation history
      this.addToConversationHistory(message);

      // Generate AI response for regular messages
      await this.handleRegularMessage(message);
      
    } catch (error) {
      console.error('Error handling message:', error);
      await message.reply('Sorry, something went wrong processing that message.').catch(() => {});
    }
  }

  async handleRegularMessage(message) {
    try {
      // Get all necessary data
      const settings = storage.getSettings();
      const persona = storage.getPersona();
      const llmSettings = storage.getLLMSettings();
      const conversationHistory = this.getConversationHistory(message.channel.id);

      // Build context for LLM
      const context = {
        systemPrompt: llmSettings.systemPrompt || settings.systemPrompt,
        characterName: persona.name,
        characterDescription: persona.description,
        exampleMessages: persona.mes_example,
        conversationHistory: conversationHistory,
        llmSettings: llmSettings,
        maxHistoryLength: 10 // Keep recent conversation context
      };

      // Generate response using LLM service
      const result = await this.llmService.generateCharacterResponse(context);

      if (result.success) {
        const response = await message.reply(result.response);
        
        // Add bot response to conversation history
        this.addToConversationHistory(response, true);
        
        // Log activity
        await storage.addActivity(`AI response generated in #${message.channel.name}`);
      } else {
        console.error('LLM generation failed:', result.error);
        
        // Use fallback response
        const fallback = result.fallbackResponse || 'Hi! 👋';
        await message.reply(fallback);
        
        await storage.addActivity(`Fallback response used in #${message.channel.name}`);
      }
    } catch (error) {
      console.error('Error in AI response generation:', error);
      await message.reply('Hi! 👋').catch(() => {});
    }
  }

  addToConversationHistory(message, isBot = false) {
    const channelId = message.channel.id;
    
    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    
    const history = this.conversationHistory.get(channelId);
    
    // Add new message
    history.push({
      author: isBot ? (storage.getPersona().name || 'Bot') : message.author.username,
      content: message.content,
      timestamp: new Date(),
      isBot: isBot
    });
    
    // Keep only recent messages
    if (history.length > this.maxHistoryPerChannel) {
      history.shift();
    }
  }

  getConversationHistory(channelId) {
    return this.conversationHistory.get(channelId) || [];
  }

  clearConversationHistory(channelId) {
    if (channelId) {
      this.conversationHistory.delete(channelId);
    } else {
      this.conversationHistory.clear();
    }
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

      case 'clear':
        await this.handleClearCommand(message);
        break;
        
      default:
        await this.handleUnknownCommand(message, command);
        break;
    }

    // Log activity
    await storage.addActivity(`Command executed: ${prefix}${command} by ${message.author.username} in #${message.channel.name}`);
  }

  async handleClearCommand(message) {
    this.clearConversationHistory(message.channel.id);
    await message.reply('🧹 Conversation history cleared for this channel.');
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
        { name: `${prefix}info`, value: 'Show bot information', inline: true },
        { name: `${prefix}clear`, value: 'Clear conversation history', inline: true }
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