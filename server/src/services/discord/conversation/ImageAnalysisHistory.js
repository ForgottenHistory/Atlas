const logger = require('../../logger/Logger');

class ImageAnalysisHistory {
  constructor() {
    this.imageAnalysisHistory = new Map(); // channelId -> image analysis array
  }

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

  getImageAnalysisHistory(channelId, limit = 10) {
    const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
    return imageHistory.slice(0, limit).reverse(); // Return oldest first, limited
  }

  getRecentImageAnalyses(limit = 20) {
    const allAnalyses = [];
    
    for (const [channelId, history] of this.imageAnalysisHistory.entries()) {
      history.forEach(analysis => allAnalyses.push(analysis));
    }
    
    // Sort by timestamp (newest first) and limit
    allAnalyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return allAnalyses.slice(0, limit);
  }

  getAnalysisCount(channelId) {
    const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
    return imageHistory.length;
  }

  getTotalAnalysisCount() {
    return Array.from(this.imageAnalysisHistory.values())
      .reduce((total, history) => total + history.length, 0);
  }

  removeChannel(channelId) {
    const imageHistory = this.imageAnalysisHistory.get(channelId) || [];
    const analysisCount = imageHistory.length;
    this.imageAnalysisHistory.delete(channelId);
    return analysisCount;
  }

  removeAllChannels() {
    const totalAnalyses = this.getTotalAnalysisCount();
    this.imageAnalysisHistory.clear();
    return totalAnalyses;
  }

  filterChannelsByServer(serverId, conversationHistory) {
    const serverChannels = [];
    
    for (const [channelId, imageHistory] of this.imageAnalysisHistory.entries()) {
      if (imageHistory.length > 0) {
        // We need to check the conversation history to get server info
        const conversationHistoryForChannel = conversationHistory.get(channelId);
        if (conversationHistoryForChannel && conversationHistoryForChannel.length > 0) {
          const channelInfo = conversationHistoryForChannel[0];
          if (channelInfo.serverId === serverId) {
            serverChannels.push(channelId);
          }
        }
      }
    }
    
    return serverChannels;
  }

  getChannelAnalysisStats() {
    const stats = {};
    
    for (const [channelId, imageHistory] of this.imageAnalysisHistory.entries()) {
      if (imageHistory.length > 0) {
        stats[channelId] = {
          totalAnalyses: imageHistory.length,
          providers: [...new Set(imageHistory.map(a => a.provider))],
          models: [...new Set(imageHistory.map(a => a.model))],
          lastAnalysis: imageHistory[0].timestamp
        };
      }
    }
    
    return stats;
  }

  cleanupOldAnalyses(maxAgeHours) {
    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    let cleanedChannels = 0;
    let cleanedAnalyses = 0;
    
    for (const [channelId, imageHistory] of this.imageAnalysisHistory.entries()) {
      const filteredImageHistory = imageHistory.filter(analysis => 
        new Date(analysis.timestamp) > cutoffTime
      );
      const removedImageCount = imageHistory.length - filteredImageHistory.length;
      
      if (removedImageCount > 0) {
        if (filteredImageHistory.length === 0) {
          this.imageAnalysisHistory.delete(channelId);
          cleanedChannels++;
        } else {
          this.imageAnalysisHistory.set(channelId, filteredImageHistory);
        }
        cleanedAnalyses += removedImageCount;
      }
    }
    
    return { cleanedChannels, cleanedAnalyses };
  }
}

module.exports = ImageAnalysisHistory;