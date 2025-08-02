const storage = require('../../utils/storage');
const logger = require('../logger/Logger');

class ConversationManager {
  constructor() {
    this.conversationHistory = new Map(); // channelId -> messages array
    
    logger.info('ConversationManager initialized', { 
      source: 'discord',
      memoryType: 'token-based dynamic'
    });
  }

  addMessage(message, isBot = false) {
    const channelId = message.channel.id;
    
    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    
    const history = this.conversationHistory.get(channelId);
    
    // Create message object with timestamp for better tracking
    const messageObj = {
      author: isBot ? (storage.getPersona().name || 'Bot') : message.author.username,
      content: message.content,
      timestamp: new Date(),
      isBot: isBot,
      messageId: message.id
    };
    
    // Add new message to the beginning (most recent first)
    history.unshift(messageObj);
    
    // No artificial limits - let token management handle it dynamically

    logger.debug('Added message to conversation history', {
      source: 'discord',
      channelId: channelId,
      totalHistoryLength: history.length,
      isBot: isBot,
      messageLength: message.content.length
    });

    return messageObj;
  }

  getHistory(channelId) {
    // Return history in reverse order (oldest first) for the LLM
    const history = this.conversationHistory.get(channelId) || [];
    return [...history].reverse();
  }

  clearHistory(channelId) {
    if (channelId) {
      const historyLength = (this.conversationHistory.get(channelId) || []).length;
      this.conversationHistory.delete(channelId);
      
      logger.info('Conversation history cleared for channel', {
        source: 'discord',
        channelId: channelId,
        messagesCleared: historyLength
      });
      
      return historyLength;
    } else {
      const totalMessages = Array.from(this.conversationHistory.values())
        .reduce((total, history) => total + history.length, 0);
      
      this.conversationHistory.clear();
      
      logger.info('All conversation history cleared', { 
        source: 'discord',
        totalMessagesCleared: totalMessages
      });
      
      return totalMessages;
    }
  }

  getMemoryStats(channelId) {
    const history = this.conversationHistory.get(channelId) || [];
    const llmSettings = storage.getLLMSettings();
    
    // Calculate rough token usage for current history
    const historyText = history.map(h => `${h.author}: ${h.content}`).join('\n');
    const roughTokens = Math.ceil(historyText.length / 4);
    const contextLimit = llmSettings.context_limit || 4096;
    
    return {
      totalMessages: history.length,
      estimatedTokens: roughTokens,
      contextLimit: contextLimit,
      maxCharacters: llmSettings.max_characters || 2000,
      usagePercentage: Math.round((roughTokens / contextLimit) * 100)
    };
  }

  // Get statistics across all channels
  getGlobalStats() {
    const allChannels = Array.from(this.conversationHistory.entries());
    const totalMessages = allChannels.reduce((total, [_, history]) => total + history.length, 0);
    const channelsWithHistory = allChannels.filter(([_, history]) => history.length > 0).length;
    
    return {
      totalChannels: this.conversationHistory.size,
      channelsWithHistory: channelsWithHistory,
      totalMessages: totalMessages,
      averageMessagesPerChannel: channelsWithHistory > 0 ? Math.round(totalMessages / channelsWithHistory) : 0
    };
  }

  // Cleanup old conversations (optional maintenance method)
  cleanupOldConversations(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    let cleanedChannels = 0;
    let cleanedMessages = 0;
    
    for (const [channelId, history] of this.conversationHistory.entries()) {
      const filteredHistory = history.filter(msg => msg.timestamp > cutoffTime);
      const removedCount = history.length - filteredHistory.length;
      
      if (removedCount > 0) {
        if (filteredHistory.length === 0) {
          this.conversationHistory.delete(channelId);
          cleanedChannels++;
        } else {
          this.conversationHistory.set(channelId, filteredHistory);
        }
        cleanedMessages += removedCount;
      }
    }
    
    if (cleanedMessages > 0) {
      logger.info('Cleaned up old conversations', {
        source: 'discord',
        cleanedChannels: cleanedChannels,
        cleanedMessages: cleanedMessages,
        maxAgeHours: maxAgeHours
      });
    }
    
    return { cleanedChannels, cleanedMessages };
  }
}

module.exports = ConversationManager;