const storage = require('../../utils/storage');
const logger = require('../logger/Logger');

class ConversationManager {
  constructor() {
    this.conversationHistory = new Map(); // channelId -> messages array
    this.imageAnalysisHistory = new Map(); // channelId -> image analysis array
    
    logger.info('ConversationManager initialized', { 
      source: 'discord',
      memoryType: 'token-based dynamic per-channel with image analysis'
    });
  }

  addMessage(message, isBot = false) {
    const channelId = message.channel.id;
    const serverId = message.guild?.id || 'DM';
    const serverName = message.guild?.name || 'Direct Message';
    const channelName = message.channel.name || 'DM';
    
    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    
    const history = this.conversationHistory.get(channelId);
    
    // Create enhanced message object with server context
    const messageObj = {
      author: isBot ? (storage.getPersona().name || 'Bot') : message.author.username,
      content: message.content,
      timestamp: new Date(),
      isBot: isBot,
      messageId: message.id,
      channelId: channelId,
      channelName: channelName,
      serverId: serverId,
      serverName: serverName,
      // Store user info for better context
      userId: message.author?.id,
      userDisplayName: message.author?.displayName || message.author?.username,
      // Include image analysis if present
      imageAnalysis: message.imageAnalysis || null
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
      messageLength: message.content.length,
      author: messageObj.author,
      hasImageAnalysis: !!messageObj.imageAnalysis
    });

    return messageObj;
  }

  // NEW: Add image analysis to history
  async addImageAnalysis(channelId, analysisData) {
    if (!this.imageAnalysisHistory.has(channelId)) {
      this.imageAnalysisHistory.set(channelId, []);
    }
    
    const imageHistory = this.imageAnalysisHistory.get(channelId);
    
    // Create image analysis record
    const analysisRecord = {
      messageId: analysisData.messageId,
      author: analysisData.author,
      imageUrl: analysisData.imageUrl,
      filename: analysisData.filename,
      analysis: analysisData.analysis,
      provider: analysisData.provider,
      model: analysisData.model,
      timestamp: analysisData.timestamp,
      channelId: channelId
    };
    
    // Add to beginning (most recent first)
    imageHistory.unshift(analysisRecord);
    
    // Keep only recent image analyses (last 50 per channel)
    if (imageHistory.length > 50) {
      imageHistory.splice(50);
    }
    
    logger.debug('Added image analysis to history', {
      source: 'discord',
      channelId: channelId,
      messageId: analysisData.messageId,
      provider: analysisData.provider,
      model: analysisData.model,
      totalImageHistory: imageHistory.length
    });
    
    return analysisRecord;
  }

  // NEW: Get image analysis history for a channel
  getImageAnalysisHistory(channelId, limit = 10) {
    const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
    return imageHistory.slice(0, limit).reverse(); // Return oldest first, limited
  }

  // NEW: Get recent image analyses across all channels (for statistics)
  getRecentImageAnalyses(limit = 20) {
    const allAnalyses = [];
    
    for (const [channelId, history] of this.imageAnalysisHistory.entries()) {
      history.forEach(analysis => allAnalyses.push(analysis));
    }
    
    // Sort by timestamp (newest first) and limit
    allAnalyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return allAnalyses.slice(0, limit);
  }

  getHistory(channelId, limit = null) {
    // Return history in reverse order (oldest first) for the LLM
    const history = this.conversationHistory.get(channelId) || [];
    const limitedHistory = limit ? history.slice(0, limit) : history;
    return [...limitedHistory].reverse();
  }

  clearHistory(channelId) {
    if (channelId) {
      const history = this.conversationHistory.get(channelId) || [];
      const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
      const historyLength = history.length;
      const imageHistoryLength = imageHistory.length;
      const channelInfo = history[0]; // Get channel info from first message
      
      this.conversationHistory.delete(channelId);
      this.imageAnalysisHistory.delete(channelId);
      
      logger.info('Conversation history cleared for specific channel', {
        source: 'discord',
        channelId: channelId,
        channelName: channelInfo?.channelName || 'Unknown',
        serverName: channelInfo?.serverName || 'Unknown',
        messagesCleared: historyLength,
        imageAnalysesCleared: imageHistoryLength
      });
      
      return historyLength;
    } else {
      const totalMessages = Array.from(this.conversationHistory.values())
        .reduce((total, history) => total + history.length, 0);
      const totalImageAnalyses = Array.from(this.imageAnalysisHistory.values())
        .reduce((total, history) => total + history.length, 0);
      
      this.conversationHistory.clear();
      this.imageAnalysisHistory.clear();
      
      logger.info('All conversation history cleared across all channels', { 
        source: 'discord',
        totalMessagesCleared: totalMessages,
        totalImageAnalysesCleared: totalImageAnalyses,
        channelsCleared: this.conversationHistory.size
      });
      
      return totalMessages;
    }
  }

  getMemoryStats(channelId) {
    const history = this.conversationHistory.get(channelId) || [];
    const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
    const llmSettings = storage.getLLMSettings();
    
    // Calculate rough token usage for current history
    const historyText = history.map(h => `${h.author}: ${h.content}`).join('\n');
    const roughTokens = Math.ceil(historyText.length / 4);
    const contextLimit = llmSettings.context_limit || 4096;
    
    // Get channel info from first message if available
    const channelInfo = history[0] || {};
    
    return {
      totalMessages: history.length,
      totalImageAnalyses: imageHistory.length,
      estimatedTokens: roughTokens,
      contextLimit: contextLimit,
      maxCharacters: llmSettings.max_characters || 2000,
      usagePercentage: Math.round((roughTokens / contextLimit) * 100),
      channelInfo: {
        channelId: channelId,
        channelName: channelInfo.channelName || 'Unknown',
        serverId: channelInfo.serverId || 'Unknown',
        serverName: channelInfo.serverName || 'Unknown'
      }
    };
  }

  // Get statistics across all channels with server breakdown
  getGlobalStats() {
    const allChannels = Array.from(this.conversationHistory.entries());
    const totalMessages = allChannels.reduce((total, [_, history]) => total + history.length, 0);
    const totalImageAnalyses = Array.from(this.imageAnalysisHistory.values())
      .reduce((total, history) => total + history.length, 0);
    const channelsWithHistory = allChannels.filter(([_, history]) => history.length > 0).length;
    
    // Group by servers
    const serverStats = {};
    allChannels.forEach(([channelId, history]) => {
      if (history.length > 0) {
        const serverInfo = history[0]; // Get server info from first message
        const serverId = serverInfo.serverId || 'DM';
        const serverName = serverInfo.serverName || 'Direct Messages';
        
        if (!serverStats[serverId]) {
          serverStats[serverId] = {
            serverName: serverName,
            channels: 0,
            messages: 0,
            imageAnalyses: 0,
            channelDetails: []
          };
        }
        
        const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
        
        serverStats[serverId].channels++;
        serverStats[serverId].messages += history.length;
        serverStats[serverId].imageAnalyses += imageHistory.length;
        serverStats[serverId].channelDetails.push({
          channelId: channelId,
          channelName: serverInfo.channelName || 'Unknown',
          messageCount: history.length,
          imageAnalysisCount: imageHistory.length
        });
      }
    });
    
    return {
      totalChannels: this.conversationHistory.size,
      channelsWithHistory: channelsWithHistory,
      totalMessages: totalMessages,
      totalImageAnalyses: totalImageAnalyses,
      averageMessagesPerChannel: channelsWithHistory > 0 ? Math.round(totalMessages / channelsWithHistory) : 0,
      serverBreakdown: serverStats
    };
  }

  // Get all channels with history (useful for management UI)
  getAllChannelsWithHistory() {
    const channels = [];
    
    for (const [channelId, history] of this.conversationHistory.entries()) {
      if (history.length > 0) {
        const channelInfo = history[0]; // Get info from first message
        const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
        
        channels.push({
          channelId: channelId,
          channelName: channelInfo.channelName || 'Unknown',
          serverId: channelInfo.serverId || 'DM',
          serverName: channelInfo.serverName || 'Direct Messages',
          messageCount: history.length,
          imageAnalysisCount: imageHistory.length,
          lastMessage: {
            content: history[0].content.substring(0, 50) + (history[0].content.length > 50 ? '...' : ''),
            author: history[0].author,
            timestamp: history[0].timestamp
          }
        });
      }
    }
    
    // Sort by most recent activity
    channels.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
    
    return channels;
  }

  // Clear history for an entire server
  clearServerHistory(serverId) {
    let clearedChannels = 0;
    let clearedMessages = 0;
    let clearedImageAnalyses = 0;
    
    for (const [channelId, history] of this.conversationHistory.entries()) {
      if (history.length > 0) {
        const channelInfo = history[0];
        if (channelInfo.serverId === serverId) {
          const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
          
          clearedMessages += history.length;
          clearedImageAnalyses += imageHistory.length;
          clearedChannels++;
          
          this.conversationHistory.delete(channelId);
          this.imageAnalysisHistory.delete(channelId);
        }
      }
    }
    
    logger.info('Server conversation history cleared', {
      source: 'discord',
      serverId: serverId,
      clearedChannels: clearedChannels,
      clearedMessages: clearedMessages,
      clearedImageAnalyses: clearedImageAnalyses
    });
    
    return { clearedChannels, clearedMessages, clearedImageAnalyses };
  }

  // Cleanup old conversations (optional maintenance method)
  cleanupOldConversations(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    let cleanedChannels = 0;
    let cleanedMessages = 0;
    let cleanedImageAnalyses = 0;
    
    for (const [channelId, history] of this.conversationHistory.entries()) {
      const filteredHistory = history.filter(msg => msg.timestamp > cutoffTime);
      const removedCount = history.length - filteredHistory.length;
      
      // Also clean image analysis history
      const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
      const filteredImageHistory = imageHistory.filter(analysis => analysis.timestamp > cutoffTime);
      const removedImageCount = imageHistory.length - filteredImageHistory.length;
      
      if (removedCount > 0 || removedImageCount > 0) {
        if (filteredHistory.length === 0) {
          this.conversationHistory.delete(channelId);
          this.imageAnalysisHistory.delete(channelId);
          cleanedChannels++;
        } else {
          this.conversationHistory.set(channelId, filteredHistory);
          if (filteredImageHistory.length > 0) {
            this.imageAnalysisHistory.set(channelId, filteredImageHistory);
          } else {
            this.imageAnalysisHistory.delete(channelId);
          }
        }
        cleanedMessages += removedCount;
        cleanedImageAnalyses += removedImageCount;
      }
    }
    
    if (cleanedMessages > 0 || cleanedImageAnalyses > 0) {
      logger.info('Cleaned up old conversations across channels', {
        source: 'discord',
        cleanedChannels: cleanedChannels,
        cleanedMessages: cleanedMessages,
        cleanedImageAnalyses: cleanedImageAnalyses,
        maxAgeHours: maxAgeHours
      });
    }
    
    return { cleanedChannels, cleanedMessages, cleanedImageAnalyses };
  }
}

module.exports = ConversationManager;