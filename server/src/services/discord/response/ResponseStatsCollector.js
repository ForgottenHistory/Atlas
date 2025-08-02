const storage = require('../../../utils/storage');

class ResponseStatsCollector {
  getResponseStats(channelId, conversationManager, llmService) {
    const memoryStats = conversationManager.getMemoryStats(channelId);
    const llmSettings = storage.getLLMSettings();
    
    return {
      memoryStats,
      responseSettings: {
        maxCharacters: llmSettings.max_characters || 2000,
        contextLimit: llmSettings.context_limit || 4096,
        model: llmSettings.model || 'default',
        temperature: llmSettings.temperature || 0.6
      },
      estimatedResponseTime: this.estimateResponseTime(memoryStats),
      queueStats: llmService.getQueueStats(),
      performance: this.getPerformanceMetrics(memoryStats, llmSettings)
    };
  }

  estimateResponseTime(memoryStats) {
    // Rough estimation based on token count
    // More tokens = longer processing time
    const baseTime = 1000; // 1 second base
    const tokenMultiplier = memoryStats.estimatedTokens * 0.1; // 0.1ms per token
    const queueDelay = 500; // Average queue delay
    
    return Math.round(baseTime + tokenMultiplier + queueDelay);
  }

  getPerformanceMetrics(memoryStats, llmSettings) {
    const contextUsage = (memoryStats.estimatedTokens / (llmSettings.context_limit || 4096)) * 100;
    
    return {
      contextUsagePercentage: Math.round(contextUsage),
      memoryEfficiency: this.calculateMemoryEfficiency(memoryStats),
      recommendedOptimizations: this.getOptimizationRecommendations(memoryStats, llmSettings)
    };
  }

  calculateMemoryEfficiency(memoryStats) {
    // Higher efficiency = more messages fit in context relative to total available
    if (memoryStats.totalMessages === 0) return 100;
    
    const efficiency = Math.min(100, (memoryStats.estimatedTokens / memoryStats.contextLimit) * 100);
    return Math.round(efficiency);
  }

  getOptimizationRecommendations(memoryStats, llmSettings) {
    const recommendations = [];
    
    const contextUsage = (memoryStats.estimatedTokens / (llmSettings.context_limit || 4096)) * 100;
    
    if (contextUsage > 90) {
      recommendations.push('Consider increasing context limit - running near capacity');
    }
    
    if (contextUsage < 30 && memoryStats.totalMessages > 0) {
      recommendations.push('Context limit could be reduced for faster processing');
    }
    
    if (llmSettings.max_characters > 1500) {
      recommendations.push('Consider reducing max characters for faster responses');
    }
    
    if (llmSettings.temperature > 1.5) {
      recommendations.push('High temperature may cause inconsistent responses');
    }
    
    if (!llmSettings.model || llmSettings.model === 'default') {
      recommendations.push('Select a specific model for better performance');
    }
    
    return recommendations;
  }

  // Method to track response generation metrics over time
  trackResponseMetrics(response, metadata, context) {
    const metrics = {
      timestamp: new Date().toISOString(),
      responseLength: response.length,
      responseTime: metadata.responseTime || 0,
      tokenUsage: metadata.tokenUsage || {},
      truncated: metadata.truncationInfo?.wasTruncated || false,
      contextSize: context.conversationHistory?.length || 0,
      character: context.characterName || 'Unknown',
      channel: context.channel?.name || 'Unknown'
    };
    
    // This could be expanded to store metrics in a database or file
    // For now, just return the metrics object
    return metrics;
  }

  // Method to generate performance summary
  generatePerformanceSummary(channelId, conversationManager, llmService) {
    const stats = this.getResponseStats(channelId, conversationManager, llmService);
    const queueHealth = llmService.getQueueHealth();
    
    return {
      overall: this.getOverallPerformanceScore(stats, queueHealth),
      bottlenecks: this.identifyBottlenecks(stats, queueHealth),
      suggestions: this.getPerformanceSuggestions(stats, queueHealth)
    };
  }

  getOverallPerformanceScore(stats, queueHealth) {
    let score = 100;
    
    // Deduct for high context usage
    if (stats.performance.contextUsagePercentage > 80) score -= 20;
    
    // Deduct for queue issues
    if (!queueHealth.healthy) score -= 30;
    
    // Deduct for slow estimated response time
    if (stats.estimatedResponseTime > 3000) score -= 15;
    
    // Deduct for too many optimizations needed
    if (stats.performance.recommendedOptimizations.length > 2) score -= 10;
    
    return Math.max(0, score);
  }

  identifyBottlenecks(stats, queueHealth) {
    const bottlenecks = [];
    
    if (!queueHealth.healthy) {
      bottlenecks.push('Request queue is overloaded');
    }
    
    if (stats.performance.contextUsagePercentage > 90) {
      bottlenecks.push('Context limit nearly exceeded');
    }
    
    if (stats.estimatedResponseTime > 5000) {
      bottlenecks.push('High estimated response time');
    }
    
    if (stats.memoryStats.totalMessages > 100) {
      bottlenecks.push('Large conversation history may slow processing');
    }
    
    return bottlenecks;
  }

  getPerformanceSuggestions(stats, queueHealth) {
    const suggestions = [];
    
    if (!queueHealth.healthy) {
      suggestions.push('Reduce concurrent requests or increase queue limits');
    }
    
    if (stats.performance.contextUsagePercentage > 80) {
      suggestions.push('Increase context limit or implement conversation summarization');
    }
    
    if (stats.responseSettings.maxCharacters > 1500) {
      suggestions.push('Reduce max character limit for faster generation');
    }
    
    if (stats.responseSettings.temperature > 1.2) {
      suggestions.push('Lower temperature for more consistent responses');
    }
    
    return suggestions;
  }
}

module.exports = ResponseStatsCollector;