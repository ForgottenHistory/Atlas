const logger = require('../logger/Logger');

class LLMStatsManager {
  constructor(requestQueue) {
    this.requestQueue = requestQueue;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      longestResponseTime: 0,
      shortestResponseTime: Infinity
    };
    
    this.setupMetricsTracking();
  }

  setupMetricsTracking() {
    // Track request completion for metrics
    // This would need to be integrated with the actual request processing
    logger.debug('Stats manager initialized with metrics tracking', {
      source: 'llm',
      metricsEnabled: true
    });
  }

  // Queue statistics methods
  getQueueStats() {
    return this.requestQueue.getQueueStats();
  }

  getQueueHealth() {
    return this.requestQueue.isHealthy();
  }

  setQueueConcurrencyLimit(requestType, limit) {
    this.requestQueue.setConcurrencyLimit(requestType, limit);
    
    logger.info('Queue concurrency limit updated via Stats Manager', {
      source: 'llm',
      requestType,
      newLimit: limit
    });
  }

  setGlobalConcurrencyLimit(limit) {
    this.requestQueue.setGlobalConcurrencyLimit(limit);
    
    logger.info('Global queue concurrency limit updated via Stats Manager', {
      source: 'llm',
      newLimit: limit
    });
  }

  updateQueueConfiguration(config) {
    if (config.globalLimit !== undefined) {
      this.setGlobalConcurrencyLimit(config.globalLimit);
    }
    
    if (config.typeLimits) {
      for (const [type, limit] of Object.entries(config.typeLimits)) {
        this.setQueueConcurrencyLimit(type, limit);
      }
    }
    
    if (config.processingDelay !== undefined) {
      this.requestQueue.setProcessingDelay(config.processingDelay);
    }
  }

  // Performance metrics methods
  recordRequest(type, responseTime, success = true) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    if (responseTime) {
      this.metrics.totalResponseTime += responseTime;
      this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.successfulRequests;
      this.metrics.longestResponseTime = Math.max(this.metrics.longestResponseTime, responseTime);
      this.metrics.shortestResponseTime = Math.min(this.metrics.shortestResponseTime, responseTime);
    }
    
    logger.debug('Request metrics recorded', {
      source: 'llm',
      type,
      responseTime,
      success,
      totalRequests: this.metrics.totalRequests
    });
  }

  getPerformanceMetrics() {
    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 0;
      
    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      shortestResponseTime: this.metrics.shortestResponseTime === Infinity ? 0 : this.metrics.shortestResponseTime
    };
  }

  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      longestResponseTime: 0,
      shortestResponseTime: Infinity
    };
    
    logger.info('Performance metrics reset', { source: 'llm' });
  }

  // Advanced analytics methods
  getQueueAnalytics() {
    const queueStats = this.getQueueStats();
    const queueHealth = this.getQueueHealth();
    const performanceMetrics = this.getPerformanceMetrics();
    
    return {
      queue: queueStats,
      health: queueHealth,
      performance: performanceMetrics,
      recommendations: this.generateRecommendations(queueStats, queueHealth, performanceMetrics),
      timestamp: new Date().toISOString()
    };
  }

  generateRecommendations(queueStats, queueHealth, performanceMetrics) {
    const recommendations = [];
    
    // Queue-based recommendations
    if (!queueHealth.healthy) {
      recommendations.push('Queue is overloaded - consider increasing global or type-specific limits');
    }
    
    if (queueHealth.totalQueued > 10) {
      recommendations.push('High queue backlog - requests may experience delays');
    }
    
    // Performance-based recommendations
    if (performanceMetrics.successRate < 95) {
      recommendations.push('Low success rate detected - check provider configuration');
    }
    
    if (performanceMetrics.averageResponseTime > 5000) {
      recommendations.push('High average response time - consider optimizing prompts or provider');
    }
    
    // Type-specific recommendations
    for (const [type, stats] of Object.entries(queueStats.types)) {
      if (stats.queued > stats.limit * 2) {
        recommendations.push(`High queue for ${type} requests - consider increasing limit`);
      }
    }
    
    return recommendations;
  }

  // Queue monitoring and alerting
  getQueueAlerts() {
    const alerts = [];
    const queueStats = this.getQueueStats();
    const queueHealth = this.getQueueHealth();
    
    // Critical alerts
    if (queueHealth.totalQueued > 50) {
      alerts.push({
        level: 'critical',
        message: 'Queue severely overloaded',
        metric: 'totalQueued',
        value: queueHealth.totalQueued,
        threshold: 50
      });
    }
    
    // Warning alerts
    if (queueHealth.totalQueued > 20) {
      alerts.push({
        level: 'warning',
        message: 'Queue backlog building up',
        metric: 'totalQueued',
        value: queueHealth.totalQueued,
        threshold: 20
      });
    }
    
    // Performance alerts
    if (this.metrics.successRate < 90 && this.metrics.totalRequests > 10) {
      alerts.push({
        level: 'warning',
        message: 'Low success rate detected',
        metric: 'successRate',
        value: this.metrics.successRate,
        threshold: 90
      });
    }
    
    return alerts;
  }

  // Historical data management
  getHistoricalStats(timeWindow = '1h') {
    // This would integrate with a time-series database in production
    // For now, return current metrics with timestamp
    return {
      timeWindow,
      timestamp: new Date().toISOString(),
      metrics: this.getPerformanceMetrics(),
      queue: this.getQueueStats(),
      health: this.getQueueHealth()
    };
  }

  // System health assessment
  assessSystemHealth() {
    const queueHealth = this.getQueueHealth();
    const performanceMetrics = this.getPerformanceMetrics();
    const alerts = this.getQueueAlerts();
    
    let overallHealth = 'healthy';
    
    if (alerts.some(alert => alert.level === 'critical')) {
      overallHealth = 'critical';
    } else if (alerts.some(alert => alert.level === 'warning')) {
      overallHealth = 'warning';
    } else if (!queueHealth.healthy || performanceMetrics.successRate < 95) {
      overallHealth = 'degraded';
    }
    
    return {
      status: overallHealth,
      score: this.calculateHealthScore(queueHealth, performanceMetrics),
      alerts,
      recommendations: this.generateRecommendations(this.getQueueStats(), queueHealth, performanceMetrics),
      lastUpdated: new Date().toISOString()
    };
  }

  calculateHealthScore(queueHealth, performanceMetrics) {
    let score = 100;
    
    // Queue health impact
    if (!queueHealth.healthy) score -= 30;
    if (queueHealth.totalQueued > 10) score -= Math.min(20, queueHealth.totalQueued);
    
    // Performance impact
    score -= (100 - performanceMetrics.successRate) * 0.5;
    if (performanceMetrics.averageResponseTime > 3000) {
      score -= Math.min(20, (performanceMetrics.averageResponseTime - 3000) / 100);
    }
    
    return Math.max(0, Math.round(score));
  }

  // Configuration and tuning helpers
  suggestOptimalLimits() {
    const queueStats = this.getQueueStats();
    const performanceMetrics = this.getPerformanceMetrics();
    
    const suggestions = {
      global: queueStats.global.limit,
      types: {}
    };
    
    // Suggest increases for consistently busy queues
    for (const [type, stats] of Object.entries(queueStats.types)) {
      if (stats.queued > stats.limit && performanceMetrics.successRate > 95) {
        suggestions.types[type] = Math.min(stats.limit + 2, 10); // Conservative increase
      } else {
        suggestions.types[type] = stats.limit;
      }
    }
    
    // Suggest global limit adjustment
    const totalOptimal = Object.values(suggestions.types).reduce((sum, limit) => sum + limit, 0);
    suggestions.global = Math.max(suggestions.global, Math.ceil(totalOptimal * 0.8));
    
    return {
      current: {
        global: queueStats.global.limit,
        types: Object.fromEntries(
          Object.entries(queueStats.types).map(([type, stats]) => [type, stats.limit])
        )
      },
      suggested: suggestions,
      reasoning: this.explainSuggestions(queueStats, performanceMetrics, suggestions)
    };
  }

  explainSuggestions(queueStats, performanceMetrics, suggestions) {
    const explanations = [];
    
    for (const [type, suggestedLimit] of Object.entries(suggestions.types)) {
      const currentLimit = queueStats.types[type]?.limit || 1;
      const currentQueued = queueStats.types[type]?.queued || 0;
      
      if (suggestedLimit > currentLimit) {
        explanations.push(`Increase ${type} limit to ${suggestedLimit} (currently ${currentQueued} queued vs ${currentLimit} limit)`);
      }
    }
    
    if (suggestions.global > queueStats.global.limit) {
      explanations.push(`Increase global limit to ${suggestions.global} to accommodate type-specific increases`);
    }
    
    return explanations;
  }
}

module.exports = LLMStatsManager;