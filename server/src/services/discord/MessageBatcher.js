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
    try {
      // DEFENSIVE: Validate message object
      if (!message) {
        logger.warn('MessageBatcher received null/undefined message', { source: 'discord' });
        return;
      }

      // DEFENSIVE: Ensure required properties exist
      const safeChannel = message.channel || {};
      const safeAuthor = message.author || {};
      
      const channelId = safeChannel.id || 'unknown';
      const userId = safeAuthor.id || 'unknown';

      // Skip if we don't have valid IDs
      if (channelId === 'unknown' || userId === 'unknown') {
        logger.warn('MessageBatcher: Invalid channel or user ID, processing immediately', {
          source: 'discord',
          hasChannel: !!message.channel,
          hasChannelId: !!(message.channel?.id),
          hasAuthor: !!message.author,
          hasUserId: !!(message.author?.id)
        });
        
        // Process immediately without batching
        try {
          await processCallback(message);
        } catch (error) {
          logger.error('Error processing unbatched message', {
            source: 'discord',
            error: error.message
          });
        }
        return;
      }
      
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
        author: safeAuthor.username || 'Unknown',
        channel: safeChannel.name || 'Unknown',
        batchSize: userBatch.messages.length,
        messageContent: (message.content || '').substring(0, 50)
      });
      
      // Set new timeout to process the batch
      userBatch.timeout = setTimeout(async () => {
        await this.processBatch(channelId, userId, processCallback);
      }, this.batchTimeout);

    } catch (error) {
      logger.error('Error in MessageBatcher.addToBatch', {
        source: 'discord',
        error: error.message,
        stack: error.stack
      });
      
      // Fallback: process message immediately
      try {
        await processCallback(message);
      } catch (fallbackError) {
        logger.error('Fallback processing also failed', {
          source: 'discord',
          error: fallbackError.message
        });
      }
    }
  }
  
  /**
   * Process a completed batch
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @param {Function} processCallback - Callback to process the batch
   */
  async processBatch(channelId, userId, processCallback) {
    try {
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
      
      // DEFENSIVE: Ensure lastMessage exists
      if (!lastMessage) {
        logger.warn('MessageBatcher: No last message in batch', {
          source: 'discord',
          channelId: channelId,
          userId: userId,
          batchSize: messages.length
        });
        return;
      }
      
      logger.info('Processing message batch', {
        source: 'discord',
        author: lastMessage.author?.username || 'Unknown',
        channel: lastMessage.channel?.name || 'Unknown',
        batchSize: messages.length,
        combinedLength: messages.reduce((sum, msg) => sum + (msg.content || '').length, 0)
      });
      
      // Combine all messages in the batch
      const combinedContent = messages.map(msg => msg.content || '').join(' ');
      
      // FIXED: Store original Discord message for reply functionality
      lastMessage.batchedContent = combinedContent;
      lastMessage.originalMessages = messages;
      lastMessage.isBatched = true;
      lastMessage._originalDiscordMessage = lastMessage; // Store reference to self with methods
      
      // Process with the original message (preserves Discord.js methods)
      try {
        await processCallback(lastMessage);
      } catch (error) {
        logger.error('Error processing message batch', {
          source: 'discord',
          error: error.message,
          stack: error.stack,
          batchSize: messages.length,
          author: lastMessage.author?.username || 'Unknown',
          hasChannel: !!lastMessage.channel,
          hasAuthor: !!lastMessage.author
        });
      }
      
      // Clean up the batch
      channelBatches.delete(userId);
      if (channelBatches.size === 0) {
        this.messageBatches.delete(channelId);
      }

    } catch (error) {
      logger.error('Error in MessageBatcher.processBatch', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        channelId: channelId,
        userId: userId
      });
    }
  }

  /**
   * Get current batch statistics
   * @returns {Object} - Batch statistics
   */
  getBatchStats() {
    let totalBatches = 0;
    let totalMessages = 0;
    
    try {
      for (const channelBatches of this.messageBatches.values()) {
        for (const userBatch of channelBatches.values()) {
          totalBatches++;
          totalMessages += userBatch.messages?.length || 0;
        }
      }
    } catch (error) {
      logger.error('Error getting batch stats', {
        source: 'discord',
        error: error.message
      });
    }
    
    return {
      totalBatches,
      totalMessages,
      activeChannels: this.messageBatches.size
    };
  }
}

module.exports = MessageBatcher;