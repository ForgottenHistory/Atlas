const MessageProcessor = require('./message/MessageProcessor');
const MessageListener = require('./message/MessageListener');
const MessageStats = require('./message/MessageStats');
const logger = require('../logger/Logger');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    
    // Initialize specialized services
    this.processor = new MessageProcessor(discordClient, channelManager);
    this.listener = new MessageListener();
    this.stats = new MessageStats(this.processor);
    
    this.setupMessageListener();
    
    logger.info('MessageHandler initialized with autonomous decision making and image processing', { 
      source: 'discord',
      services: ['MessageProcessor', 'MessageListener', 'MessageStats']
    });
  }

  setupMessageListener() {
    const client = this.discordClient.getClient();
    if (!client) return;

    this.listener.setupListener(client, this.handleMessage.bind(this), (message) => {
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
      if (message.author.bot) return;
      
      await this.processor.processMessage(message);
      
    } catch (error) {
      logger.error('Error in message handler', {
        source: 'discord',
        error: error.message,
        author: message.author?.username || 'Unknown',
        channel: message.channel?.name || 'Unknown'
      });
    }
  }

  // Public API - delegate to appropriate services
  getConversationHistory(channelId) {
    return this.processor.getConversationHistory(channelId);
  }

  clearConversationHistory(channelId) {
    return this.processor.clearConversationHistory(channelId);
  }

  getMemoryStats(channelId) {
    return this.processor.getMemoryStats(channelId);
  }

  getBatchStats() {
    return this.stats.getBatchStats();
  }

  getQueueStats() {
    return this.stats.getQueueStats();
  }

  getQueueHealth() {
    return this.stats.getQueueHealth();
  }

  getDecisionStats() {
    return this.stats.getDecisionStats();
  }

  getImageProcessingStats() {
    return this.stats.getImageProcessingStats();
  }

  // Event system methods
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