const storage = require('../../utils/storage');
const logger = require('../logger/Logger');
const ConversationManager = require('./ConversationManager');
const CommandHandler = require('./commands/CommandHandler');
const ResponseGenerator = require('./response/ResponseGenerator');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    
    // Initialize components
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager);
    
    // NEW: Message batching system
    this.messageBatches = new Map(); // channelId -> { userId -> batchData }
    this.batchTimeout = 3000; // 3 seconds to wait for more messages
    
    this.setupMessageListener();
    
    logger.info('MessageHandler initialized with smart message batching', { 
      source: 'discord',
      batchTimeout: this.batchTimeout,
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

      // Handle commands immediately (don't batch)
      if (message.content.startsWith(prefix)) {
        await this.commandHandler.handleCommand(message, prefix);
        return;
      }

      // Store message in conversation history
      this.conversationManager.addMessage(message);

      // NEW: Smart message batching
      await this.handleMessageBatching(message);
      
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

  async handleMessageBatching(message) {
    const channelId = message.channel.id;
    const userId = message.author.id;
    
    // Initialize channel batches if needed
    if (!this.messageBatches.has(channelId)) {
      this.messageBatches.set(channelId, new Map());
    }
    
    const channelBatches = this.messageBatches.get(channelId);
    
    // Get or create batch for this user
    if (!channelBatches.has(userId)) {
      channelBatches.set(userId, {
        messages: [],
        lastMessage: null,
        timeout: null
      });
    }
    
    const userBatch = channelBatches.get(userId);
    
    // Clear existing timeout if there was one
    if (userBatch.timeout) {
      clearTimeout(userBatch.timeout);
    }
    
    // Add message to batch
    userBatch.messages.push(message);
    userBatch.lastMessage = message;
    
    logger.debug('Message added to batch', {
      source: 'discord',
      author: message.author.username,
      channel: message.channel.name,
      batchSize: userBatch.messages.length,
      messageContent: message.content.substring(0, 50)
    });
    
    // Set new timeout to process the batch
    userBatch.timeout = setTimeout(async () => {
      await this.processBatch(channelId, userId);
    }, this.batchTimeout);
  }
  
  async processBatch(channelId, userId) {
    const channelBatches = this.messageBatches.get(channelId);
    if (!channelBatches || !channelBatches.has(userId)) {
      return;
    }
    
    const userBatch = channelBatches.get(userId);
    if (!userBatch || userBatch.messages.length === 0) {
      return;
    }
    
    const messages = userBatch.messages;
    const lastMessage = userBatch.lastMessage;
    
    logger.info('Processing message batch', {
      source: 'discord',
      author: lastMessage.author.username,
      channel: lastMessage.channel.name,
      batchSize: messages.length,
      combinedLength: messages.reduce((sum, msg) => sum + msg.content.length, 0)
    });
    
    // Combine all messages in the batch
    const combinedContent = messages.map(msg => msg.content).join(' ');
    
    // FIX: Create a proper synthetic message object with all required properties
    const combinedMessage = {
      id: lastMessage.id,
      content: combinedContent,
      author: {
        id: lastMessage.author.id,
        username: lastMessage.author.username,
        bot: lastMessage.author.bot
      },
      channel: {
        id: lastMessage.channel.id,
        name: lastMessage.channel.name,
        send: lastMessage.channel.send.bind(lastMessage.channel)
      },
      guild: lastMessage.guild ? {
        id: lastMessage.guild.id,
        name: lastMessage.guild.name
      } : null,
      createdTimestamp: lastMessage.createdTimestamp,
      reply: lastMessage.reply.bind(lastMessage),
      originalMessages: messages,
      // Copy any other Discord.js properties that might be needed
      channelId: lastMessage.channelId,
      guildId: lastMessage.guildId
    };
    
    // Generate AI response for the combined message
    try {
      await this.responseGenerator.generateAndSendResponse(combinedMessage);
    } catch (error) {
      logger.error('Error processing message batch', {
        source: 'discord',
        error: error.message,
        batchSize: messages.length,
        author: lastMessage.author.username,
        hasChannel: !!combinedMessage.channel,
        hasAuthor: !!combinedMessage.author
      });
    }
    
    // Clean up the batch
    channelBatches.delete(userId);
    if (channelBatches.size === 0) {
      this.messageBatches.delete(channelId);
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