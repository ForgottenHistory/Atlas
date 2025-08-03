const logger = require('../../logger/Logger');

class ActionLogger {
  constructor() {
    this.stats = {
      totalActions: 0,
      actionCounts: {},
      successfulActions: 0,
      failedActions: 0,
      lastActionTime: null,
      avgExecutionTime: 0,
      totalExecutionTime: 0
    };
  }

  logActionDecision(decision, message) {
    logger.info('Executing bot action', {
      source: 'discord',
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      channel: message.channel.name,
      server: message.guild?.name || 'DM'
    });
  }

  logActionResult(decision, message, result) {
    const executionTime = Date.now();
    
    // Update statistics
    this.updateStats(decision.action, result.success, executionTime);
    
    if (result.success) {
      logger.success(`${decision.action} action completed successfully`, {
        source: 'discord',
        action: decision.action,
        channel: message.channel.name,
        actionType: result.actionType,
        ...this.getActionSpecificData(result)
      });
    } else {
      logger.error(`${decision.action} action failed`, {
        source: 'discord',
        action: decision.action,
        error: result.error,
        channel: message.channel.name
      });
    }
  }

  updateStats(action, success, executionTime) {
    this.stats.totalActions++;
    this.stats.lastActionTime = new Date();
    
    // Count by action type
    if (!this.stats.actionCounts[action]) {
      this.stats.actionCounts[action] = { total: 0, successful: 0, failed: 0 };
    }
    
    this.stats.actionCounts[action].total++;
    
    if (success) {
      this.stats.successfulActions++;
      this.stats.actionCounts[action].successful++;
    } else {
      this.stats.failedActions++;
      this.stats.actionCounts[action].failed++;
    }
    
    // Update execution time (simplified - in real implementation you'd track start time)
    this.stats.totalExecutionTime += executionTime;
    this.stats.avgExecutionTime = this.stats.totalExecutionTime / this.stats.totalActions;
  }

  getActionSpecificData(result) {
    const data = {};
    
    switch (result.actionType) {
      case 'respond':
      case 'reply':
        if (result.result && result.result.response) {
          data.responseLength = result.result.response.length;
        }
        break;
        
      case 'react':
        if (result.emoji) {
          data.emoji = result.emoji;
        }
        break;
        
      case 'status_change':
        if (result.status) {
          data.newStatus = result.status;
        }
        break;
        
      case 'ignore':
        if (result.reasoning) {
          data.reasoning = result.reasoning;
        }
        break;
    }
    
    return data;
  }

  getStats() {
    const successRate = this.stats.totalActions > 0 
      ? (this.stats.successfulActions / this.stats.totalActions) * 100 
      : 0;
      
    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      mostUsedAction: this.getMostUsedAction(),
      actionBreakdown: this.getActionBreakdown()
    };
  }

  getMostUsedAction() {
    let mostUsed = null;
    let highestCount = 0;
    
    for (const [action, counts] of Object.entries(this.stats.actionCounts)) {
      if (counts.total > highestCount) {
        highestCount = counts.total;
        mostUsed = action;
      }
    }
    
    return mostUsed;
  }

  getActionBreakdown() {
    const breakdown = {};
    
    for (const [action, counts] of Object.entries(this.stats.actionCounts)) {
      const successRate = counts.total > 0 ? (counts.successful / counts.total) * 100 : 0;
      
      breakdown[action] = {
        ...counts,
        successRate: Math.round(successRate * 100) / 100,
        percentage: this.stats.totalActions > 0 
          ? Math.round((counts.total / this.stats.totalActions) * 100 * 100) / 100
          : 0
      };
    }
    
    return breakdown;
  }

  resetStats() {
    this.stats = {
      totalActions: 0,
      actionCounts: {},
      successfulActions: 0,
      failedActions: 0,
      lastActionTime: null,
      avgExecutionTime: 0,
      totalExecutionTime: 0
    };
    
    logger.info('Action statistics reset', { source: 'discord' });
  }

  getRecentActivity(limit = 10) {
    // This would integrate with a more sophisticated logging system
    // For now, return basic stats
    return {
      lastActionTime: this.stats.lastActionTime,
      recentActionCount: Math.min(this.stats.totalActions, limit),
      totalActions: this.stats.totalActions,
      successRate: this.getStats().successRate
    };
  }

  generateReport() {
    const stats = this.getStats();
    
    return {
      summary: {
        totalActions: stats.totalActions,
        successRate: stats.successRate,
        mostUsedAction: stats.mostUsedAction,
        lastActionTime: stats.lastActionTime
      },
      breakdown: stats.actionBreakdown,
      performance: {
        avgExecutionTime: Math.round(stats.avgExecutionTime),
        successfulActions: stats.successfulActions,
        failedActions: stats.failedActions
      },
      recommendations: this.generateRecommendations(stats),
      generatedAt: new Date().toISOString()
    };
  }

  generateRecommendations(stats) {
    const recommendations = [];
    
    if (stats.successRate < 90) {
      recommendations.push('Action success rate is below 90% - investigate failures');
    }
    
    if (!stats.lastActionTime) {
      recommendations.push('No actions have been executed yet');
    } else {
      const timeSinceLastAction = Date.now() - new Date(stats.lastActionTime).getTime();
      if (timeSinceLastAction > 3600000) { // 1 hour
        recommendations.push('No recent action activity - check decision engine');
      }
    }
    
    // Check for imbalanced action usage
    const actionTypes = Object.keys(stats.actionCounts);
    if (actionTypes.length === 1 && actionTypes[0] === 'ignore') {
      recommendations.push('Only ignore actions detected - decision engine may be too conservative');
    }
    
    if (stats.actionCounts.react && stats.actionCounts.react.percentage > 70) {
      recommendations.push('High reaction usage - consider more varied responses');
    }
    
    return recommendations;
  }
}

module.exports = ActionLogger;