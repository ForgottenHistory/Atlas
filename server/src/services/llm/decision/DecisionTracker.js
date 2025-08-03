const logger = require('../../logger/Logger');

class DecisionTracker {
  constructor() {
    this.lastDecisionTime = new Date();
    this.decisionHistory = [];
    this.stats = {
      totalDecisions: 0,
      actionCounts: {},
      averageConfidence: 0,
      totalConfidence: 0,
      channelActivity: {}
    };
  }

  trackDecision(decision, context) {
    const timestamp = new Date();
    
    // Create decision record
    const record = {
      decision: decision,
      context: {
        channel: context.channel?.name || 'Unknown',
        server: context.channel?.guild?.name || 'DM',
        author: context.message?.author?.username || 'Unknown',
        hasImages: context.hasImages || false,
        messageLength: context.message?.content?.length || 0
      },
      timestamp: timestamp,
      id: this.generateDecisionId()
    };

    // Add to history
    this.decisionHistory.unshift(record);
    
    // Keep only recent decisions (last 100)
    if (this.decisionHistory.length > 100) {
      this.decisionHistory = this.decisionHistory.slice(0, 100);
    }

    // Update statistics
    this.updateStats(decision, context);
    
    // Update last decision time
    this.lastDecisionTime = timestamp;

    logger.debug('Decision tracked', {
      source: 'llm',
      action: decision.action,
      confidence: decision.confidence,
      channel: record.context.channel,
      totalDecisions: this.stats.totalDecisions
    });

    return record;
  }

  updateStats(decision, context) {
    this.stats.totalDecisions++;
    
    // Track action counts
    if (!this.stats.actionCounts[decision.action]) {
      this.stats.actionCounts[decision.action] = 0;
    }
    this.stats.actionCounts[decision.action]++;
    
    // Track confidence
    this.stats.totalConfidence += decision.confidence;
    this.stats.averageConfidence = this.stats.totalConfidence / this.stats.totalDecisions;
    
    // Track channel activity
    const channelKey = `${context.channel?.guild?.name || 'DM'}#${context.channel?.name || 'DM'}`;
    if (!this.stats.channelActivity[channelKey]) {
      this.stats.channelActivity[channelKey] = {
        decisions: 0,
        actions: {},
        lastActivity: null
      };
    }
    
    const channelStats = this.stats.channelActivity[channelKey];
    channelStats.decisions++;
    channelStats.lastActivity = new Date();
    
    if (!channelStats.actions[decision.action]) {
      channelStats.actions[decision.action] = 0;
    }
    channelStats.actions[decision.action]++;
  }

  getLastDecisionTime() {
    return this.lastDecisionTime;
  }

  timeSinceLastAction() {
    const now = new Date();
    const diffMs = now - this.lastDecisionTime;
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m`;
    return `${Math.floor(diffSecs / 3600)}h`;
  }

  updateLastActionTime() {
    this.lastDecisionTime = new Date();
  }

  getDecisionStats() {
    return {
      totalDecisions: this.stats.totalDecisions,
      averageConfidence: Math.round(this.stats.averageConfidence * 100) / 100,
      actionBreakdown: this.getActionBreakdown(),
      mostCommonAction: this.getMostCommonAction(),
      channelActivity: this.getChannelActivitySummary(),
      lastDecisionTime: this.lastDecisionTime,
      timeSinceLastAction: this.timeSinceLastAction()
    };
  }

  getActionBreakdown() {
    const breakdown = {};
    const total = this.stats.totalDecisions;
    
    for (const [action, count] of Object.entries(this.stats.actionCounts)) {
      breakdown[action] = {
        count: count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      };
    }
    
    return breakdown;
  }

  getMostCommonAction() {
    let mostCommon = null;
    let highestCount = 0;
    
    for (const [action, count] of Object.entries(this.stats.actionCounts)) {
      if (count > highestCount) {
        highestCount = count;
        mostCommon = action;
      }
    }
    
    return mostCommon;
  }

  getChannelActivitySummary() {
    const summary = {};
    
    for (const [channel, stats] of Object.entries(this.stats.channelActivity)) {
      summary[channel] = {
        decisions: stats.decisions,
        mostCommonAction: this.getMostCommonActionForChannel(stats.actions),
        lastActivity: stats.lastActivity
      };
    }
    
    return summary;
  }

  getMostCommonActionForChannel(actions) {
    let mostCommon = null;
    let highestCount = 0;
    
    for (const [action, count] of Object.entries(actions)) {
      if (count > highestCount) {
        highestCount = count;
        mostCommon = action;
      }
    }
    
    return mostCommon;
  }

  getDecisionHistory(limit = 10) {
    return this.decisionHistory.slice(0, limit);
  }

  getDecisionsByAction(action, limit = 10) {
    return this.decisionHistory
      .filter(record => record.decision.action === action)
      .slice(0, limit);
  }

  getDecisionsByChannel(channelName, limit = 10) {
    return this.decisionHistory
      .filter(record => record.context.channel === channelName)
      .slice(0, limit);
  }

  getDecisionsByTimeRange(startTime, endTime) {
    return this.decisionHistory.filter(record => {
      const recordTime = new Date(record.timestamp);
      return recordTime >= startTime && recordTime <= endTime;
    });
  }

  generateDecisionId() {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Analytics methods
  getDecisionTrends(timeWindowHours = 24) {
    const cutoffTime = new Date(Date.now() - (timeWindowHours * 60 * 60 * 1000));
    const recentDecisions = this.decisionHistory.filter(record => 
      new Date(record.timestamp) > cutoffTime
    );

    const hourlyBreakdown = {};
    const actionTrends = {};

    recentDecisions.forEach(record => {
      const hour = new Date(record.timestamp).getHours();
      const action = record.decision.action;

      // Hourly breakdown
      if (!hourlyBreakdown[hour]) {
        hourlyBreakdown[hour] = 0;
      }
      hourlyBreakdown[hour]++;

      // Action trends
      if (!actionTrends[action]) {
        actionTrends[action] = [];
      }
      actionTrends[action].push(record.timestamp);
    });

    return {
      totalRecentDecisions: recentDecisions.length,
      hourlyBreakdown: hourlyBreakdown,
      actionTrends: actionTrends,
      peakActivity: this.findPeakActivityHour(hourlyBreakdown)
    };
  }

  findPeakActivityHour(hourlyBreakdown) {
    let peakHour = null;
    let peakCount = 0;

    for (const [hour, count] of Object.entries(hourlyBreakdown)) {
      if (count > peakCount) {
        peakCount = count;
        peakHour = parseInt(hour);
      }
    }

    return { hour: peakHour, count: peakCount };
  }

  getConfidenceAnalysis() {
    if (this.decisionHistory.length === 0) {
      return {
        averageConfidence: 0,
        confidenceDistribution: {},
        lowConfidenceDecisions: [],
        highConfidenceDecisions: []
      };
    }

    const confidences = this.decisionHistory.map(record => record.decision.confidence);
    const confidenceDistribution = {
      'low (0.0-0.3)': 0,
      'medium (0.3-0.7)': 0,
      'high (0.7-1.0)': 0
    };

    confidences.forEach(confidence => {
      if (confidence < 0.3) {
        confidenceDistribution['low (0.0-0.3)']++;
      } else if (confidence < 0.7) {
        confidenceDistribution['medium (0.3-0.7)']++;
      } else {
        confidenceDistribution['high (0.7-1.0)']++;
      }
    });

    return {
      averageConfidence: this.stats.averageConfidence,
      confidenceDistribution: confidenceDistribution,
      lowConfidenceDecisions: this.decisionHistory
        .filter(record => record.decision.confidence < 0.3)
        .slice(0, 5),
      highConfidenceDecisions: this.decisionHistory
        .filter(record => record.decision.confidence > 0.7)
        .slice(0, 5)
    };
  }

  generateReport() {
    const stats = this.getDecisionStats();
    const trends = this.getDecisionTrends();
    const confidenceAnalysis = this.getConfidenceAnalysis();

    return {
      summary: {
        totalDecisions: stats.totalDecisions,
        averageConfidence: stats.averageConfidence,
        mostCommonAction: stats.mostCommonAction,
        timeSinceLastAction: stats.timeSinceLastAction
      },
      breakdown: stats.actionBreakdown,
      trends: trends,
      confidence: confidenceAnalysis,
      channels: stats.channelActivity,
      recommendations: this.generateRecommendations(stats, trends, confidenceAnalysis),
      generatedAt: new Date().toISOString()
    };
  }

  generateRecommendations(stats, trends, confidenceAnalysis) {
    const recommendations = [];

    // Check decision frequency
    if (stats.totalDecisions === 0) {
      recommendations.push('No decisions recorded yet - decision engine may not be active');
    } else if (trends.totalRecentDecisions === 0) {
      recommendations.push('No recent decision activity - check if bot is receiving messages');
    }

    // Check action balance
    const ignorePercentage = stats.actionBreakdown.ignore?.percentage || 0;
    if (ignorePercentage > 80) {
      recommendations.push('High ignore rate (>80%) - decision engine may be too conservative');
    } else if (ignorePercentage < 20) {
      recommendations.push('Low ignore rate (<20%) - decision engine may be too aggressive');
    }

    // Check confidence levels
    if (confidenceAnalysis.averageConfidence < 0.4) {
      recommendations.push('Low average confidence - review decision-making prompts');
    }

    // Check channel distribution
    const channelCount = Object.keys(stats.channelActivity).length;
    if (channelCount === 0) {
      recommendations.push('No channel activity recorded');
    } else if (channelCount === 1) {
      recommendations.push('Activity only in one channel - consider expanding to more channels');
    }

    return recommendations;
  }

  resetStats() {
    this.decisionHistory = [];
    this.stats = {
      totalDecisions: 0,
      actionCounts: {},
      averageConfidence: 0,
      totalConfidence: 0,
      channelActivity: {}
    };
    this.lastDecisionTime = new Date();

    logger.info('Decision tracking statistics reset', { source: 'llm' });
  }
}

module.exports = DecisionTracker;