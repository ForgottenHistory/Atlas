const storage = require('../../../utils/storage');

class ConversationStats {
  constructor(conversationHistory, imageAnalysisHistory) {
    this.conversationHistory = conversationHistory;
    this.imageAnalysisHistory = imageAnalysisHistory;
  }

  getMemoryStats(channelId) {
    const history = this.conversationHistory.getHistory(channelId);
    const imageHistory = this.imageAnalysisHistory?.getImageAnalysisHistory(channelId) || [];
    // FIX: Use main settings instead of separate LLM settings
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};

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

  getGlobalStats() {
    const allChannelIds = this.conversationHistory.getAllChannelIds();
    const totalMessages = allChannelIds.reduce((total, channelId) =>
      total + this.conversationHistory.getHistoryLength(channelId), 0
    );
    const totalImageAnalyses = this.imageAnalysisHistory?.getTotalAnalysisCount() || 0;
    const channelsWithHistory = allChannelIds.filter(channelId =>
      this.conversationHistory.hasHistory(channelId)
    ).length;

    // Group by servers
    const serverStats = this.getServerBreakdown();

    return {
      totalChannels: allChannelIds.length,
      channelsWithHistory: channelsWithHistory,
      totalMessages: totalMessages,
      totalImageAnalyses: totalImageAnalyses,
      averageMessagesPerChannel: channelsWithHistory > 0 ? Math.round(totalMessages / channelsWithHistory) : 0,
      serverBreakdown: serverStats
    };
  }

  getServerBreakdown() {
    const serverStats = {};
    const allChannels = this.conversationHistory.getAllChannelsWithMessages();

    allChannels.forEach(channel => {
      const serverId = channel.serverId || 'DM';
      const serverName = channel.serverName || 'Direct Messages';

      if (!serverStats[serverId]) {
        serverStats[serverId] = {
          serverName: serverName,
          channels: 0,
          messages: 0,
          imageAnalyses: 0,
          channelDetails: []
        };
      }

      const imageAnalysisCount = this.imageAnalysisHistory?.getAnalysisCount(channel.channelId) || 0;

      serverStats[serverId].channels++;
      serverStats[serverId].messages += channel.messageCount;
      serverStats[serverId].imageAnalyses += imageAnalysisCount;
      serverStats[serverId].channelDetails.push({
        channelId: channel.channelId,
        channelName: channel.channelName,
        messageCount: channel.messageCount,
        imageAnalysisCount: imageAnalysisCount
      });
    });

    return serverStats;
  }

  getAllChannelsWithHistory() {
    const channels = this.conversationHistory.getAllChannelsWithMessages();

    // Add image analysis counts to each channel
    return channels.map(channel => ({
      ...channel,
      imageAnalysisCount: this.imageAnalysisHistory?.getAnalysisCount(channel.channelId) || 0
    }));
  }

  getChannelRankings() {
    const channels = this.getAllChannelsWithHistory();

    return {
      mostActive: channels.sort((a, b) => b.messageCount - a.messageCount).slice(0, 10),
      mostImages: channels.sort((a, b) => b.imageAnalysisCount - a.imageAnalysisCount).slice(0, 10),
      mostRecent: channels.sort((a, b) =>
        new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
      ).slice(0, 10)
    };
  }

  getServerStats(serverId) {
    const serverBreakdown = this.getServerBreakdown();
    return serverBreakdown[serverId] || null;
  }

  getUsageAnalytics() {
    const globalStats = this.getGlobalStats();
    const serverBreakdown = globalStats.serverBreakdown;

    return {
      totalActivity: globalStats.totalMessages + globalStats.totalImageAnalyses,
      serverCount: Object.keys(serverBreakdown).length,
      averageChannelsPerServer: Object.keys(serverBreakdown).length > 0
        ? Math.round(globalStats.channelsWithHistory / Object.keys(serverBreakdown).length)
        : 0,
      imageToMessageRatio: globalStats.totalMessages > 0
        ? Math.round((globalStats.totalImageAnalyses / globalStats.totalMessages) * 100) / 100
        : 0,
      mostActiveServer: this.getMostActiveServer(serverBreakdown)
    };
  }

  getMostActiveServer(serverBreakdown) {
    let mostActive = null;
    let highestActivity = 0;

    for (const [serverId, stats] of Object.entries(serverBreakdown)) {
      const activity = stats.messages + stats.imageAnalyses;
      if (activity > highestActivity) {
        highestActivity = activity;
        mostActive = {
          serverId,
          serverName: stats.serverName,
          totalActivity: activity,
          messages: stats.messages,
          imageAnalyses: stats.imageAnalyses,
          channels: stats.channels
        };
      }
    }

    return mostActive;
  }
}

module.exports = ConversationStats;