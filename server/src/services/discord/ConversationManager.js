const ConversationHistory = require('./conversation/ConversationHistory');
const ImageAnalysisHistory = require('./conversation/ImageAnalysisHistory');
const ConversationStats = require('./conversation/ConversationStats');
const ConversationCleaner = require('./conversation/ConversationCleaner');
const logger = require('../logger/Logger');

class ConversationManager {
  constructor() {
    this.conversationHistory = new ConversationHistory();
    this.imageAnalysisHistory = new ImageAnalysisHistory();
    this.stats = new ConversationStats(this.conversationHistory, this.imageAnalysisHistory);
    this.cleaner = new ConversationCleaner(this.conversationHistory, this.imageAnalysisHistory);
    
    logger.info('ConversationManager initialized', { 
      source: 'discord',
      memoryType: 'token-based dynamic per-channel with image analysis'
    });
  }

  // Message management
  addMessage(message, isBot = false) {
    return this.conversationHistory.addMessage(message, isBot);
  }

  getHistory(channelId, limit = null) {
    return this.conversationHistory.getHistory(channelId, limit);
  }

  // Image analysis management
  async addImageAnalysis(channelId, analysisData) {
    return await this.imageAnalysisHistory.addImageAnalysis(channelId, analysisData);
  }

  getImageAnalysisHistory(channelId, limit = 10) {
    return this.imageAnalysisHistory.getImageAnalysisHistory(channelId, limit);
  }

  getRecentImageAnalyses(limit = 20) {
    return this.imageAnalysisHistory.getRecentImageAnalyses(limit);
  }

  // Statistics
  getMemoryStats(channelId) {
    return this.stats.getMemoryStats(channelId);
  }

  getGlobalStats() {
    return this.stats.getGlobalStats();
  }

  getAllChannelsWithHistory() {
    return this.stats.getAllChannelsWithHistory();
  }

  // Cleanup operations
  clearHistory(channelId) {
    return this.cleaner.clearHistory(channelId);
  }

  clearServerHistory(serverId) {
    return this.cleaner.clearServerHistory(serverId);
  }

  cleanupOldConversations(maxAgeHours = 24) {
    return this.cleaner.cleanupOldConversations(maxAgeHours);
  }
}

module.exports = ConversationManager;