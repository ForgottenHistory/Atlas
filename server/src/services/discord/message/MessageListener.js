const logger = require('../../logger/Logger');

class MessageListener {
  constructor() {
    this.isListening = false;
  }

  setupListener(client, messageHandler, onMessageReceived = null) {
    if (!client) {
      logger.warn('Cannot setup message listener - no Discord client provided', {
        source: 'discord'
      });
      return;
    }

    if (this.isListening) {
      logger.debug('Message listener already setup', { source: 'discord' });
      return;
    }

    client.on('messageCreate', async (message) => {
      try {
        // Skip bot messages at the listener level
        if (message.author.bot) return;
        
        // Call the message handler
        await messageHandler(message);
        
        // Emit message received event if callback provided
        if (onMessageReceived) {
          onMessageReceived(message);
        }
        
      } catch (error) {
        logger.error('Error in message listener', {
          source: 'discord',
          error: error.message,
          messageId: message.id,
          author: message.author?.username || 'Unknown',
          channel: message.channel?.name || 'Unknown'
        });
      }
    });

    this.isListening = true;
    
    logger.info('Message listener setup complete', {
      source: 'discord',
      clientReady: client.isReady()
    });
  }

  removeListener(client) {
    if (client && this.isListening) {
      client.removeAllListeners('messageCreate');
      this.isListening = false;
      
      logger.info('Message listener removed', { source: 'discord' });
    }
  }

  isActive() {
    return this.isListening;
  }

  getListenerInfo() {
    return {
      isListening: this.isListening,
      handlerType: typeof this.messageHandler,
      setupTime: new Date().toISOString()
    };
  }

  // Advanced listener features
  setupConditionalListener(client, messageHandler, conditions = {}, onMessageReceived = null) {
    const {
      allowedChannels = null, // Array of channel IDs
      allowedUsers = null,    // Array of user IDs
      allowedGuilds = null,   // Array of guild IDs
      messageFilters = []     // Array of filter functions
    } = conditions;

    if (!client) {
      logger.warn('Cannot setup conditional message listener - no Discord client provided', {
        source: 'discord'
      });
      return;
    }

    client.on('messageCreate', async (message) => {
      try {
        // Skip bot messages
        if (message.author.bot) return;
        
        // Apply conditions
        if (!this.passesConditions(message, conditions)) {
          return;
        }
        
        // Apply custom filters
        if (messageFilters.length > 0) {
          const passesFilters = messageFilters.every(filter => filter(message));
          if (!passesFilters) return;
        }
        
        // Call the message handler
        await messageHandler(message);
        
        // Emit message received event if callback provided
        if (onMessageReceived) {
          onMessageReceived(message);
        }
        
      } catch (error) {
        logger.error('Error in conditional message listener', {
          source: 'discord',
          error: error.message,
          messageId: message.id,
          author: message.author?.username || 'Unknown',
          channel: message.channel?.name || 'Unknown'
        });
      }
    });

    this.isListening = true;
    
    logger.info('Conditional message listener setup complete', {
      source: 'discord',
      conditions: Object.keys(conditions),
      filterCount: messageFilters.length
    });
  }

  passesConditions(message, conditions) {
    const {
      allowedChannels,
      allowedUsers,
      allowedGuilds
    } = conditions;

    // Check channel restrictions
    if (allowedChannels && !allowedChannels.includes(message.channel.id)) {
      return false;
    }

    // Check user restrictions
    if (allowedUsers && !allowedUsers.includes(message.author.id)) {
      return false;
    }

    // Check guild restrictions
    if (allowedGuilds && message.guild && !allowedGuilds.includes(message.guild.id)) {
      return false;
    }

    return true;
  }

  // Rate limiting for message processing
  setupRateLimitedListener(client, messageHandler, rateLimit = { maxPerMinute: 60 }, onMessageReceived = null) {
    const messageCount = new Map(); // userId -> { count, resetTime }
    
    client.on('messageCreate', async (message) => {
      try {
        if (message.author.bot) return;
        
        // Check rate limit
        if (!this.checkRateLimit(message.author.id, rateLimit, messageCount)) {
          logger.debug('Message rate limited', {
            source: 'discord',
            author: message.author.username,
            rateLimit: rateLimit.maxPerMinute
          });
          return;
        }
        
        // Call the message handler
        await messageHandler(message);
        
        // Emit message received event if callback provided
        if (onMessageReceived) {
          onMessageReceived(message);
        }
        
      } catch (error) {
        logger.error('Error in rate limited message listener', {
          source: 'discord',
          error: error.message,
          messageId: message.id,
          author: message.author?.username || 'Unknown'
        });
      }
    });

    this.isListening = true;
    
    logger.info('Rate limited message listener setup complete', {
      source: 'discord',
      maxPerMinute: rateLimit.maxPerMinute
    });
  }

  checkRateLimit(userId, rateLimit, messageCount) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    
    if (!messageCount.has(userId)) {
      messageCount.set(userId, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    const userCount = messageCount.get(userId);
    
    if (now > userCount.resetTime) {
      // Reset the window
      messageCount.set(userId, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (userCount.count >= rateLimit.maxPerMinute) {
      return false;
    }
    
    userCount.count++;
    return true;
  }
}

module.exports = MessageListener;