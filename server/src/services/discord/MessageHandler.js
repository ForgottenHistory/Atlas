const storage = require('../../utils/storage');
const logger = require('../logger/Logger');
const ConversationManager = require('./ConversationManager');
const CommandHandler = require('./CommandHandler');
const ResponseGenerator = require('./response/ResponseGenerator');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    
    // Initialize components
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager); // Pass conversationManager
    
    this.setupMessageListener();
    
    logger.info('MessageHandler initialized with singleton LLM service', { 
      source: 'discord',
      components: ['ConversationManager', 'CommandHandler', 'ResponseGenerator'],
      singleton: true
    });
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
        logger.debug('Message in inactive channel ignored', {
          source: 'discord',
          channel: message.channel.name,
          author: message.author.username
        });
        return;
      }
      
      const settings = storage.getSettings();
      const prefix = settings.commandPrefix || '!';

      // Handle commands first
      if (message.content.startsWith(prefix)) {
        await this.commandHandler.handleCommand(message, prefix);
        return;
      }

      // Store message in conversation history
      this.conversationManager.addMessage(message);

      // Generate AI response for regular messages
      await this.responseGenerator.generateAndSendResponse(message);
      
    } catch (error) {
      logger.error('Error handling message', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message.id,
        author: message.author.username,
        channel: message.channel.name
      });
      
      await message.reply('Sorry, something went wrong processing that message.').catch(() => {});
    }
  }

  // Public API for other components
  getConversationHistory(channelId) {
    return this.conversationManager.getHistory(channelId);
  }

  clearConversationHistory(channelId) {
    return this.conversationManager.clearHistory(channelId);
  }

  getMemoryStats(channelId) {
    return this.conversationManager.getMemoryStats(channelId);
  }

  // Queue-related methods
  getQueueStats() {
    return this.responseGenerator.getQueueStats();
  }

  getQueueHealth() {
    return this.responseGenerator.getQueueHealth();
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