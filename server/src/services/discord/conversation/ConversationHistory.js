const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');

class ConversationHistory {
  constructor() {
    this.conversationHistory = new Map(); // channelId -> messages array
  }

  addMessage(message, isBot = false) {
    // DEFENSIVE: Handle missing message properties safely
    if (!message) {
      logger.warn('Attempted to add null/undefined message to history', {
        source: 'discord',
        isBot: isBot
      });
      return null;
    }

    // Safely extract properties with fallbacks
    const safeChannel = message.channel || {};
    const safeGuild = message.guild || null;
    const safeAuthor = message.author || {};
    
    const channelId = safeChannel.id || 'unknown';
    const serverId = safeGuild?.id || 'DM';
    const serverName = safeGuild?.name || 'Direct Message';
    const channelName = safeChannel.name || 'DM';
    
    // Skip if we don't have a valid channel ID
    if (channelId === 'unknown') {
      logger.warn('Cannot add message without valid channel ID', {
        source: 'discord',
        hasMessage: !!message,
        hasChannel: !!message.channel,
        hasChannelId: !!(message.channel?.id),
        isBot: isBot
      });
      return null;
    }
    
    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    
    const history = this.conversationHistory.get(channelId);
    
    // Create enhanced message object with server context
    const messageObj = {
      author: isBot ? (storage.getPersona().name || 'Bot') : (safeAuthor.username || 'Unknown'),
      content: message.batchedContent || message.content || '', // Use batched content if available
      timestamp: new Date(),
      isBot: isBot,
      messageId: message.id || 'unknown',
      channelId: channelId,
      channelName: channelName,
      serverId: serverId,
      serverName: serverName,
      // Store user info for better context
      userId: safeAuthor.id || 'unknown',
      userDisplayName: safeAuthor.displayName || safeAuthor.username || 'Unknown',
      // Include image analysis if present
      imageAnalysis: message.imageAnalysis || null,
      // Include batch info if this was a batched message
      isBatched: message.isBatched || false,
      originalMessages: message.originalMessages || null
    };
    
    // Add new message to the beginning (most recent first)
    history.unshift(messageObj);
    
    // No artificial limits - let token management handle it dynamically

    logger.debug('Added message to channel conversation history', {
      source: 'discord',
      channelId: channelId,
      channelName: channelName,
      serverId: serverId,
      serverName: serverName,
      totalHistoryLength: history.length,
      isBot: isBot,
      messageLength: (message.content || '').length,
      author: messageObj.author,
      hasImageAnalysis: !!messageObj.imageAnalysis
    });

    return messageObj;
  }

  getHistory(channelId, limit = null) {
    // Return history in reverse order (oldest first) for the LLM
    const history = this.conversationHistory.get(channelId) || [];
    const limitedHistory = limit ? history.slice(0, limit) : history;
    
    // Return in chronological order (oldest first) for better context building
    return limitedHistory.reverse();
  }

  hasHistory(channelId) {
    return this.conversationHistory.has(channelId) && this.conversationHistory.get(channelId).length > 0;
  }

  getChannelIds() {
    return Array.from(this.conversationHistory.keys());
  }

  clearChannel(channelId) {
    const had = this.conversationHistory.has(channelId);
    this.conversationHistory.delete(channelId);
    
    if (had) {
      logger.info('Cleared conversation history for channel', {
        source: 'discord',
        channelId: channelId
      });
    }
    
    return had;
  }

  clearAll() {
    const channelCount = this.conversationHistory.size;
    this.conversationHistory.clear();
    
    logger.info('Cleared all conversation history', {
      source: 'discord',
      channelsCleared: channelCount
    });
    
    return channelCount;
  }

  // Get memory usage statistics
  getMemoryUsage() {
    let totalMessages = 0;
    let totalCharacters = 0;
    
    for (const [channelId, messages] of this.conversationHistory) {
      totalMessages += messages.length;
      totalCharacters += messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    }
    
    return {
      channels: this.conversationHistory.size,
      totalMessages: totalMessages,
      totalCharacters: totalCharacters,
      averageMessagesPerChannel: this.conversationHistory.size > 0 ? Math.round(totalMessages / this.conversationHistory.size) : 0
    };
  }

  // Cleanup old messages based on age
  cleanupOldMessages(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    let totalRemoved = 0;
    
    for (const [channelId, messages] of this.conversationHistory) {
      const originalLength = messages.length;
      
      // Filter out messages older than cutoff
      const filteredMessages = messages.filter(msg => {
        const messageTime = new Date(msg.timestamp);
        return messageTime > cutoffTime;
      });
      
      const removedCount = originalLength - filteredMessages.length;
      totalRemoved += removedCount;
      
      if (removedCount > 0) {
        this.conversationHistory.set(channelId, filteredMessages);
        
        logger.debug('Cleaned up old messages for channel', {
          source: 'discord',
          channelId: channelId,
          removedCount: removedCount,
          remainingCount: filteredMessages.length
        });
      }
    }
    
    if (totalRemoved > 0) {
      logger.info('Cleanup completed', {
        source: 'discord',
        totalRemoved: totalRemoved,
        maxAgeHours: maxAgeHours
      });
    }
    
    return totalRemoved;
  }
}

module.exports = ConversationHistory;