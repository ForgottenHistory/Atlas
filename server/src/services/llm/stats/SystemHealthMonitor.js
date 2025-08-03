class SystemHealthMonitor {
  constructor(queueStatsTracker, performanceMetrics) {
    this.queueStats = queueStatsTracker;
    this.performanceMetrics = performanceMetrics;
  }

  getQueueAnalytics() {
    const queueStats = this.queueStats.getQueueStats();
    const queueHealth = this.queueStats.getQueueHealth();
    const performanceMetrics = this.performanceMetrics.getPerformanceMetrics();
    
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

  getQueueAlerts() {
    const alerts = [];
    const queueStats = this.queueStats.getQueueStats();
    const queueHealth = this.queueStats.getQueueHealth();
    const performanceMetrics = this.performanceMetrics.getPerformanceMetrics();
    
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
    if (performanceMetrics.successRate < 90 && performanceMetrics.totalRequests > 10) {
      alerts.push({
        level: 'warning',
        message: 'Low success rate detected',
        metric: 'successRate',
        value: performanceMetrics.successRate,
        threshold: 90
      });
    }
    
    return alerts;
  }

  assessSystemHealth() {
    const queueHealth = this.queueStats.getQueueHealth();
    const performanceMetrics = this.performanceMetrics.getPerformanceMetrics();
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
      recommendations: this.generateRecommendations(this.queueStats.getQueueStats(), queueHealth, performanceMetrics),
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

  getHistoricalStats(timeWindow = '1h') {
    // This would integrate with a time-series database in production
    // For now, return current metrics with timestamp
    return {
      timeWindow,
      timestamp: new Date().toISOString(),
      metrics: this.performanceMetrics.getPerformanceMetrics(),
      queue: this.queueStats.getQueueStats(),
      health: this.queueStats.getQueueHealth()
    };
  }

  getSystemDiagnostics() {
    const queueStats = this.queueStats.getQueueStats();
    const queueHealth = this.queueStats.getQueueHealth();
    const performanceMetrics = this.performanceMetrics.getPerformanceMetrics();
    const bottlenecks = this.queueStats.getBottlenecks();
    const performanceIssues = this.performanceMetrics.getPerformanceIssues();
    
    return {
      system: {
        status: this.assessSystemHealth().status,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      },
      queue: {
        stats: queueStats,
        health: queueHealth,
        bottlenecks: bottlenecks,
        utilization: this.queueStats.getQueueUtilization()
      },
      performance: {
        metrics: performanceMetrics,
        issues: performanceIssues,
        summary: this.performanceMetrics.getPerformanceSummary()
      },
      alerts: this.getQueueAlerts(),
      recommendations: this.generateRecommendations(queueStats, queueHealth, performanceMetrics)
    };
  }
}

module.exports = SystemHealthMonitor;