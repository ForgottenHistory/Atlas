const logger = require('../../logger/Logger');

class ConversationHistoryLoader {
  constructor(discordClient) {
    this.discordClient = discordClient;
    this.maxAgeHours = 2; // Don't load messages older than 2 hours
    this.maxMessages = 50; // Maximum messages to load per channel
  }

  async loadRecentHistory(channelId, conversationManager) {
    try {
      // Handle both wrapped and raw Discord clients
      const client = this.discordClient.getClient ? 
        this.discordClient.getClient() : 
        this.discordClient;
      
      if (!client) {
        logger.warn('Discord client not available for history loading', {
          source: 'discord',
          channelId: channelId
        });
        return false;
      }

      const channel = client.channels.cache.get(channelId);
      if (!channel) {
        logger.warn('Channel not found for history loading', {
          source: 'discord',
          channelId: channelId
        });
        return false;
      }

      logger.info('Loading recent conversation history on-demand', {
        source: 'discord',
        channelId: channelId,
        channelName: channel.name,
        maxAgeHours: this.maxAgeHours,
        maxMessages: this.maxMessages
      });

      // Calculate cutoff time
      const cutoffTime = new Date(Date.now() - (this.maxAgeHours * 60 * 60 * 1000));

      // Fetch recent messages
      const messages = await channel.messages.fetch({ 
        limit: this.maxMessages 
      });

      let loadedCount = 0;
      const messagesToLoad = [];

      // Filter and prepare messages for loading
      for (const [messageId, message] of messages) {
        // Skip messages older than cutoff
        if (message.createdAt < cutoffTime) {
          continue;
        }

        // Skip bot messages
        if (message.author.bot) {
          continue;
        }

        messagesToLoad.push(message);
      }

      // Sort messages by timestamp (oldest first for proper order)
      messagesToLoad.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Add messages to conversation manager
      for (const message of messagesToLoad) {
        conversationManager.addMessage(message, false);
        loadedCount++;
      }

      logger.success('Recent conversation history loaded successfully', {
        source: 'discord',
        channelId: channelId,
        channelName: channel.name,
        messagesLoaded: loadedCount,
        totalFetched: messages.size,
        cutoffTime: cutoffTime.toISOString()
      });

      return loadedCount > 0;

    } catch (error) {
      logger.error('Failed to load recent conversation history', {
        source: 'discord',
        channelId: channelId,
        error: error.message,
        stack: error.stack // Add stack trace for debugging
      });
      return false;
    }
  }

  async shouldLoadHistory(channelId, conversationManager) {
    // Safety check for conversationManager
    if (!conversationManager || typeof conversationManager.getHistory !== 'function') {
      logger.warn('ConversationManager not available for history check', {
        source: 'discord',
        channelId: channelId,
        hasConversationManager: !!conversationManager
      });
      return true; // Default to loading if we can't check
    }

    try {
      // Check if we already have recent history
      const existingHistory = conversationManager.getHistory(channelId, 5);
      
      logger.debug('Checking if history should be loaded', {
        source: 'discord',
        channelId: channelId,
        existingHistoryLength: existingHistory.length,
        maxAgeHours: this.maxAgeHours
      });
      
      // If we have no history at all, we should load
      if (existingHistory.length <= 1) {
        logger.info('No existing history found, will load recent messages', {
          source: 'discord',
          channelId: channelId
        });
        return true;
      }

      // If our most recent message is older than the cutoff, we should refresh
      const cutoffTime = new Date(Date.now() - (this.maxAgeHours * 60 * 60 * 1000));
      const mostRecentMessage = existingHistory[existingHistory.length - 1];
      
      if (new Date(mostRecentMessage.timestamp) < cutoffTime) {
        logger.info('Existing history is too old, will refresh', {
          source: 'discord',
          channelId: channelId,
          mostRecentMessageTime: mostRecentMessage.timestamp,
          cutoffTime: cutoffTime.toISOString()
        });
        return true;
      }

      logger.debug('Recent history exists and is fresh, no loading needed', {
        source: 'discord',
        channelId: channelId,
        historyLength: existingHistory.length
      });
      return false;

    } catch (error) {
      logger.error('Error checking if history should be loaded', {
        source: 'discord',
        channelId: channelId,
        error: error.message,
        stack: error.stack
      });
      return true; // Default to loading on error
    }
  }

  setMaxAge(hours) {
    this.maxAgeHours = hours;
    logger.info('Conversation history max age updated', {
      source: 'discord',
      maxAgeHours: hours
    });
  }

  setMaxMessages(count) {
    this.maxMessages = count;
    logger.info('Conversation history max messages updated', {
      source: 'discord',
      maxMessages: count
    });
  }
}

module.exports = ConversationHistoryLoader;