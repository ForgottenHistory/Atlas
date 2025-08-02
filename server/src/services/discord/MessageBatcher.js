const logger = require('../logger/Logger');

class MessageBatcher {
  constructor(batchTimeout = 3000) {
    this.messageBatches = new Map(); // channelId -> { userId -> batchData }
    this.batchTimeout = batchTimeout;
    
    logger.info('MessageBatcher initialized', { 
      source: 'discord',
      batchTimeout: this.batchTimeout
    });
  }

  /**
   * Add message to batch and handle batching logic
   * @param {Object} message - Discord message object
   * @param {Function} processCallback - Callback to process the batch
   */
  async addToBatch(message, processCallback) {
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
      await this.processBatch(channelId, userId, processCallback);
    }, this.batchTimeout);
  }
  
  /**
   * Process a completed batch
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @param {Function} processCallback - Callback to process the batch
   */
  async processBatch(channelId, userId, processCallback) {
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
    
    // FIX: Don't create a new object, modify the original message directly
    const originalContent = lastMessage.content;
    lastMessage.content = combinedContent;
    lastMessage.originalMessages = messages;
    lastMessage.originalContent = originalContent;
    
    // Process the batch using callback with the modified original message
    try {
      await processCallback(lastMessage);
    } catch (error) {
      logger.error('Error processing message batch', {
        source: 'discord',
        error: error.message,
        batchSize: messages.length,
        author: lastMessage.author.username,
        hasChannel: !!lastMessage.channel,
        hasAuthor: !!lastMessage.author
      });
    }
    
    // Clean up the batch
    channelBatches.delete(userId);
    if (channelBatches.size === 0) {
      this.messageBatches.delete(channelId);
    }
  }

  /**
   * Get current batch statistics
   * @returns {Object} - Batch statistics
   */
  getBatchStats() {
    let totalBatches = 0;
    let totalMessages = 0;
    
    for (const channelBatches of this.messageBatches.values()) {
      for (const userBatch of channelBatches.values()) {
        totalBatches++;
        totalMessages += userBatch.messages.length;
      }
    }
    
    return {
      totalBatches,
      totalMessages,
      activeChannels: this.messageBatches.size
    };
  }
}

module.exports = MessageBatcher;