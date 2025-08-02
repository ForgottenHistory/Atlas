const storage = require('../../utils/storage');
const logger = require('../logger/Logger');
const ConversationManager = require('./ConversationManager');
const CommandHandler = require('./commands/CommandHandler');
const ResponseGenerator = require('./response/ResponseGenerator');
const MessageFilter = require('./MessageFilter');
const MessageBatcher = require('./MessageBatcher');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    
    // Initialize specialized services
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager);
    this.messageFilter = new MessageFilter();
    this.messageBatcher = new MessageBatcher(3000); // 3 second timeout
    
    this.setupMessageListener();
    
    logger.info('MessageHandler initialized as thin intermediary', { 
      source: 'discord',
      services: ['ConversationManager', 'CommandHandler', 'ResponseGenerator', 'MessageFilter', 'MessageBatcher']
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
      // Delegate to filter service for basic validation
      const shouldProcess = this.messageFilter.shouldProcessMessage(message, this.channelManager);
      if (!shouldProcess.shouldProcess) {
        return; // Skip processing based on filter decision
      }
      
      // Check if it's a command
      const settings = storage.getSettings();
      const prefix = settings.commandPrefix || '!';
      
      if (message.content.startsWith(prefix)) {
        // Delegate to command handler
        await this.commandHandler.handleCommand(message, prefix);
        return;
      }

      // Delegate to filter service for content filtering
      const filterResult = this.messageFilter.filterMessage(message);
      if (!filterResult.shouldProcess) {
        return; // Skip based on content filter (emotes, etc.)
      }

      // Store in conversation history
      this.conversationManager.addMessage(filterResult.cleanedMessage);

      // Delegate to batcher for smart batching
      await this.messageBatcher.addToBatch(
        filterResult.cleanedMessage,
        this.processMessage.bind(this)
      );
      
    } catch (error) {
      logger.error('Error in message handler intermediary', {
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

  /**
   * Process a message (called by batcher)
   * @param {Object} message - Message to process
   */
  async processMessage(message) {
    try {
      // Delegate to response generator
      await this.responseGenerator.generateAndSendResponse(message);
    } catch (error) {
      logger.error('Error processing message', {
        source: 'discord',
        error: error.message,
        author: message.author?.username || 'Unknown',
        channel: message.channel?.name || 'Unknown'
      });
    }
  }

  // Public API - delegate to appropriate services
  getConversationHistory(channelId) {
    return this.conversationManager.getHistory(channelId);
  }

  clearConversationHistory(channelId) {
    return this.conversationManager.clearHistory(channelId);
  }

  getMemoryStats(channelId) {
    return this.conversationManager.getMemoryStats(channelId);
  }

  getBatchStats() {
    return this.messageBatcher.getBatchStats();
  }

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