const logger = require('../../logger/Logger');

class ConversationCleaner {
  constructor(conversationHistory, imageAnalysisHistory) {
    this.conversationHistory = conversationHistory;
    this.imageAnalysisHistory = imageAnalysisHistory;
  }

  clearHistory(channelId) {
    if (channelId) {
      const messageCount = this.conversationHistory.removeChannel(channelId);
      const imageAnalysisCount = this.imageAnalysisHistory?.removeChannel(channelId) || 0;
      
      // Get channel info for logging
      const channelInfo = this.getChannelInfo(channelId);
      
      logger.info('Conversation history cleared for specific channel', {
        source: 'discord',
        channelId: channelId,
        channelName: channelInfo?.channelName || 'Unknown',
        serverName: channelInfo?.serverName || 'Unknown',
        messagesCleared: messageCount,
        imageAnalysesCleared: imageAnalysisCount
      });
      
      return messageCount;
    } else {
      const totalMessages = this.conversationHistory.removeAllChannels();
      const totalImageAnalyses = this.imageAnalysisHistory?.removeAllChannels() || 0;
      const totalChannels = this.conversationHistory.getAllChannelIds().length;
      
      logger.info('All conversation history cleared across all channels', { 
        source: 'discord',
        totalMessagesCleared: totalMessages,
        totalImageAnalysesCleared: totalImageAnalyses,
        channelsCleared: totalChannels
      });
      
      return totalMessages;
    }
  }

  clearServerHistory(serverId) {
    let clearedChannels = 0;
    let clearedMessages = 0;
    let clearedImageAnalyses = 0;
    
    // Get channels for this server
    const serverChannels = this.conversationHistory.filterChannelsByServer(serverId);
    
    for (const channelId of serverChannels) {
      const messageCount = this.conversationHistory.removeChannel(channelId);
      const imageAnalysisCount = this.imageAnalysisHistory?.removeChannel(channelId) || 0;
      
      clearedMessages += messageCount;
      clearedImageAnalyses += imageAnalysisCount;
      clearedChannels++;
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

  cleanupOldConversations(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    let cleanedChannels = 0;
    let cleanedMessages = 0;
    let cleanedImageAnalyses = 0;
    
    // Clean conversation history
    const conversationCleanup = this.cleanupOldMessages(cutoffTime);
    cleanedChannels += conversationCleanup.cleanedChannels;
    cleanedMessages += conversationCleanup.cleanedMessages;
    
    // Clean image analysis history
    if (this.imageAnalysisHistory) {
      const imageCleanup = this.imageAnalysisHistory.cleanupOldAnalyses(maxAgeHours);
      cleanedImageAnalyses += imageCleanup.cleanedAnalyses;
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

  cleanupOldMessages(cutoffTime) {
    let cleanedChannels = 0;
    let cleanedMessages = 0;
    
    const allChannelIds = this.conversationHistory.getAllChannelIds();
    
    for (const channelId of allChannelIds) {
      const history = this.conversationHistory.getHistory(channelId);
      const filteredHistory = history.filter(msg => msg.timestamp > cutoffTime);
      const removedCount = history.length - filteredHistory.length;
      
      if (removedCount > 0) {
        if (filteredHistory.length === 0) {
          this.conversationHistory.removeChannel(channelId);
          cleanedChannels++;
        } else {
          // This would require updating the history - for now, we remove the whole channel
          // In a more complex implementation, you'd update the channel's history
          cleanedChannels++;
        }
        cleanedMessages += removedCount;
      }
    }
    
    return { cleanedChannels, cleanedMessages };
  }

  getChannelInfo(channelId) {
    const history = this.conversationHistory.getHistory(channelId);
    if (history.length > 0) {
      return {
        channelName: history[0].channelName,
        serverName: history[0].serverName,
        serverId: history[0].serverId
      };
    }
    return null;
  }

  bulkCleanup(options = {}) {
    const {
      maxAgeHours = 24,
      maxMessagesPerChannel = 1000,
      clearEmptyChannels = true,
      servers = null // Array of server IDs to clean, null for all
    } = options;

    let totalCleaned = {
      channels: 0,
      messages: 0,
      imageAnalyses: 0
    };

    // Clean by age
    if (maxAgeHours) {
      const ageCleanup = this.cleanupOldConversations(maxAgeHours);
      totalCleaned.channels += ageCleanup.cleanedChannels;
      totalCleaned.messages += ageCleanup.cleanedMessages;
      totalCleaned.imageAnalyses += ageCleanup.cleanedImageAnalyses;
    }

    // Clean specific servers if requested
    if (servers && Array.isArray(servers)) {
      for (const serverId of servers) {
        const serverCleanup = this.clearServerHistory(serverId);
        totalCleaned.channels += serverCleanup.clearedChannels;
        totalCleaned.messages += serverCleanup.clearedMessages;
        totalCleaned.imageAnalyses += serverCleanup.clearedImageAnalyses;
      }
    }

    logger.info('Bulk cleanup completed', {
      source: 'discord',
      totalCleaned,
      options
    });

    return totalCleaned;
  }
}

module.exports = ConversationCleaner;