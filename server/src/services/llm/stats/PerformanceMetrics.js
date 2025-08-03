const logger = require('../../logger/Logger');

class PerformanceMetrics {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      longestResponseTime: 0,
      shortestResponseTime: Infinity
    };
    
    this.requestTypeMetrics = new Map(); // requestType -> metrics
  }

  recordRequest(type, responseTime, success = true) {
    // Update global metrics
    this.updateGlobalMetrics(responseTime, success);
    
    // Update type-specific metrics
    this.updateTypeMetrics(type, responseTime, success);
    
    logger.debug('Request metrics recorded', {
      source: 'llm',
      type,
      responseTime,
      success,
      totalRequests: this.metrics.totalRequests
    });
  }

  updateGlobalMetrics(responseTime, success) {
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
  }

  updateTypeMetrics(type, responseTime, success) {
    if (!this.requestTypeMetrics.has(type)) {
      this.requestTypeMetrics.set(type, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        longestResponseTime: 0,
        shortestResponseTime: Infinity
      });
    }
    
    const typeMetrics = this.requestTypeMetrics.get(type);
    typeMetrics.totalRequests++;
    
    if (success) {
      typeMetrics.successfulRequests++;
    } else {
      typeMetrics.failedRequests++;
    }
    
    if (responseTime) {
      typeMetrics.totalResponseTime += responseTime;
      typeMetrics.averageResponseTime = typeMetrics.totalResponseTime / typeMetrics.successfulRequests;
      typeMetrics.longestResponseTime = Math.max(typeMetrics.longestResponseTime, responseTime);
      typeMetrics.shortestResponseTime = Math.min(typeMetrics.shortestResponseTime, responseTime);
    }
  }

  getPerformanceMetrics() {
    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 0;
      
    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      shortestResponseTime: this.metrics.shortestResponseTime === Infinity ? 0 : this.metrics.shortestResponseTime,
      byType: this.getTypeMetrics()
    };
  }

  getTypeMetrics() {
    const typeMetrics = {};
    
    for (const [type, metrics] of this.requestTypeMetrics.entries()) {
      const successRate = metrics.totalRequests > 0 
        ? (metrics.successfulRequests / metrics.totalRequests) * 100 
        : 0;
        
      typeMetrics[type] = {
        ...metrics,
        successRate: Math.round(successRate * 100) / 100,
        shortestResponseTime: metrics.shortestResponseTime === Infinity ? 0 : metrics.shortestResponseTime
      };
    }
    
    return typeMetrics;
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
    
    this.requestTypeMetrics.clear();
    
    logger.info('Performance metrics reset', { source: 'llm' });
  }

  getPerformanceSummary() {
    const metrics = this.getPerformanceMetrics();
    
    return {
      overall: {
        requests: metrics.totalRequests,
        successRate: metrics.successRate,
        avgResponseTime: Math.round(metrics.averageResponseTime)
      },
      responseTimeAnalysis: {
        fastest: metrics.shortestResponseTime,
        slowest: metrics.longestResponseTime,
        average: Math.round(metrics.averageResponseTime),
        isPerformant: metrics.averageResponseTime < 3000 // Under 3 seconds
      },
      reliability: {
        successRate: metrics.successRate,
        isReliable: metrics.successRate > 95,
        failureCount: metrics.failedRequests
      },
      requestTypeBreakdown: metrics.byType
    };
  }

  getPerformanceIssues() {
    const issues = [];
    const metrics = this.getPerformanceMetrics();
    
    if (metrics.successRate < 90 && metrics.totalRequests > 10) {
      issues.push({
        type: 'low_success_rate',
        severity: 'high',
        message: `Low success rate: ${metrics.successRate.toFixed(1)}%`,
        value: metrics.successRate,
        threshold: 90
      });
    }
    
    if (metrics.averageResponseTime > 5000) {
      issues.push({
        type: 'slow_response',
        severity: 'medium',
        message: `High average response time: ${Math.round(metrics.averageResponseTime)}ms`,
        value: metrics.averageResponseTime,
        threshold: 5000
      });
    }
    
    if (metrics.longestResponseTime > 10000) {
      issues.push({
        type: 'very_slow_response',
        severity: 'medium',
        message: `Very slow max response time: ${Math.round(metrics.longestResponseTime)}ms`,
        value: metrics.longestResponseTime,
        threshold: 10000
      });
    }
    
    return issues;
  }
}

module.exports = PerformanceMetrics;