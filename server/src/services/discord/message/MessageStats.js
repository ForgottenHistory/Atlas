class MessageStats {
  constructor(messageProcessor) {
    this.processor = messageProcessor;
  }

  getBatchStats() {
    return this.processor.getMessageBatcher().getBatchStats();
  }

  getQueueStats() {
    return this.processor.getResponseGenerator().getQueueStats();
  }

  getQueueHealth() {
    return this.processor.getResponseGenerator().getQueueHealth();
  }

  getDecisionStats() {
    const decisionEngine = this.processor.getDecisionEngine();
    return {
      lastDecisionTime: decisionEngine.lastDecisionTime,
      timeSinceLastAction: decisionEngine.timeSinceLastAction()
    };
  }

  getImageProcessingStats() {
    return this.processor.getImageProcessor().getStats();
  }

  getConversationStats() {
    const conversationManager = this.processor.getConversationManager();
    return conversationManager.getGlobalStats();
  }

  getComprehensiveStats() {
    return {
      conversations: this.getConversationStats(),
      batching: this.getBatchStats(),
      queue: {
        stats: this.getQueueStats(),
        health: this.getQueueHealth()
      },
      decisions: this.getDecisionStats(),
      imageProcessing: this.getImageProcessingStats(),
      timestamp: new Date().toISOString()
    };
  }

  getPerformanceMetrics() {
    const stats = this.getComprehensiveStats();
    
    return {
      messageProcessing: {
        totalMessages: stats.conversations.totalMessages,
        averagePerChannel: stats.conversations.averageMessagesPerChannel,
        channelsActive: stats.conversations.channelsWithHistory
      },
      queuePerformance: {
        isHealthy: stats.queue.health.healthy,
        totalQueued: stats.queue.health.totalQueued,
        activeGlobal: stats.queue.health.activeGlobal
      },
      batchingEfficiency: {
        activeBatches: stats.batching.totalBatches,
        batchedMessages: stats.batching.totalMessages,
        activeChannels: stats.batching.activeChannels
      },
      imageAnalysis: {
        totalProcessed: stats.imageProcessing.totalProcessed,
        successRate: stats.imageProcessing.successRate,
        avgProcessingTime: stats.imageProcessing.averageProcessingTime
      }
    };
  }

  getHealthSummary() {
    const performance = this.getPerformanceMetrics();
    const issues = [];
    const warnings = [];
    
    // Check queue health
    if (!performance.queuePerformance.isHealthy) {
      issues.push('Queue is unhealthy');
    }
    
    if (performance.queuePerformance.totalQueued > 10) {
      warnings.push('High queue backlog');
    }
    
    // Check image processing
    if (performance.imageAnalysis.totalProcessed > 0) {
      const successRate = parseFloat(performance.imageAnalysis.successRate.replace('%', ''));
      if (successRate < 90) {
        warnings.push('Low image processing success rate');
      }
    }
    
    // Check conversation activity
    if (performance.messageProcessing.channelsActive === 0) {
      warnings.push('No active conversations');
    }
    
    let overallHealth = 'healthy';
    if (issues.length > 0) {
      overallHealth = 'unhealthy';
    } else if (warnings.length > 0) {
      overallHealth = 'warning';
    }
    
    return {
      status: overallHealth,
      issues,
      warnings,
      metrics: performance,
      lastChecked: new Date().toISOString()
    };
  }

  getUsageAnalytics() {
    const stats = this.getComprehensiveStats();
    
    return {
      activity: {
        totalMessages: stats.conversations.totalMessages,
        totalImageAnalyses: stats.conversations.totalImageAnalyses,
        serverCount: Object.keys(stats.conversations.serverBreakdown).length,
        channelCount: stats.conversations.totalChannels
      },
      processing: {
        batchProcessing: stats.batching.totalBatches > 0,
        imageProcessing: stats.imageProcessing.totalProcessed > 0,
        decisionMaking: !!stats.decisions.lastDecisionTime
      },
      performance: {
        queueEfficiency: stats.queue.health.healthy,
        imageSuccessRate: stats.imageProcessing.successRate,
        avgImageProcessingTime: stats.imageProcessing.averageProcessingTime
      },
      trends: {
        mostActiveServer: this.getMostActiveServer(stats.conversations.serverBreakdown),
        imageToMessageRatio: this.calculateImageToMessageRatio(stats.conversations)
      }
    };
  }

  getMostActiveServer(serverBreakdown) {
    let mostActive = null;
    let highestActivity = 0;
    
    for (const [serverId, serverStats] of Object.entries(serverBreakdown)) {
      const activity = serverStats.messages + serverStats.imageAnalyses;
      if (activity > highestActivity) {
        highestActivity = activity;
        mostActive = {
          serverId,
          serverName: serverStats.serverName,
          totalActivity: activity
        };
      }
    }
    
    return mostActive;
  }

  calculateImageToMessageRatio(conversationStats) {
    if (conversationStats.totalMessages === 0) return 0;
    return Math.round((conversationStats.totalImageAnalyses / conversationStats.totalMessages) * 100) / 100;
  }

  generateReport() {
    const health = this.getHealthSummary();
    const analytics = this.getUsageAnalytics();
    const performance = this.getPerformanceMetrics();
    
    return {
      summary: {
        overallHealth: health.status,
        totalMessages: analytics.activity.totalMessages,
        activeServers: analytics.activity.serverCount,
        imageProcessingEnabled: analytics.processing.imageProcessing
      },
      health: health,
      performance: performance,
      analytics: analytics,
      recommendations: this.generateRecommendations(health, performance),
      generatedAt: new Date().toISOString()
    };
  }

  generateRecommendations(health, performance) {
    const recommendations = [];
    
    if (!performance.queuePerformance.isHealthy) {
      recommendations.push('Consider increasing queue limits or reducing concurrent processing');
    }
    
    if (performance.batchingEfficiency.activeBatches > 10) {
      recommendations.push('High number of active batches - consider reducing batch timeout');
    }
    
    if (performance.messageProcessing.channelsActive === 0) {
      recommendations.push('No active conversations - check channel configuration');
    }
    
    if (performance.imageAnalysis.totalProcessed > 0) {
      const successRate = parseFloat(performance.imageAnalysis.successRate.replace('%', ''));
      if (successRate < 90) {
        recommendations.push('Image processing success rate is low - check API configuration');
      }
    }
    
    return recommendations;
  }
}

module.exports = MessageStats;