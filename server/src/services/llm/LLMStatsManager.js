const QueueStatsTracker = require('./stats/QueueStatsTracker');
const PerformanceMetrics = require('./stats/PerformanceMetrics');
const SystemHealthMonitor = require('./stats/SystemHealthMonitor');
const ConfigurationAnalyzer = require('./stats/ConfigurationAnalyzer');
const logger = require('../logger/Logger');

class LLMStatsManager {
  constructor(requestQueue) {
    this.requestQueue = requestQueue;
    this.queueStats = new QueueStatsTracker(requestQueue);
    this.performanceMetrics = new PerformanceMetrics();
    this.healthMonitor = new SystemHealthMonitor(this.queueStats, this.performanceMetrics);
    this.configAnalyzer = new ConfigurationAnalyzer(this.queueStats, this.performanceMetrics);
    
    this.setupMetricsTracking();
  }

  setupMetricsTracking() {
    // Track request completion for metrics
    logger.debug('Stats manager initialized with metrics tracking', {
      source: 'llm',
      metricsEnabled: true
    });
  }

  // Queue statistics methods
  getQueueStats() {
    return this.queueStats.getQueueStats();
  }

  getQueueHealth() {
    return this.queueStats.getQueueHealth();
  }

  setQueueConcurrencyLimit(requestType, limit) {
    this.queueStats.setQueueConcurrencyLimit(requestType, limit);
  }

  setGlobalConcurrencyLimit(limit) {
    this.queueStats.setGlobalConcurrencyLimit(limit);
  }

  updateQueueConfiguration(config) {
    this.queueStats.updateQueueConfiguration(config);
  }

  // Performance metrics methods
  recordRequest(type, responseTime, success = true) {
    this.performanceMetrics.recordRequest(type, responseTime, success);
  }

  getPerformanceMetrics() {
    return this.performanceMetrics.getPerformanceMetrics();
  }

  resetMetrics() {
    this.performanceMetrics.resetMetrics();
  }

  // Analytics and monitoring
  getQueueAnalytics() {
    return this.healthMonitor.getQueueAnalytics();
  }

  getQueueAlerts() {
    return this.healthMonitor.getQueueAlerts();
  }

  assessSystemHealth() {
    return this.healthMonitor.assessSystemHealth();
  }

  getHistoricalStats(timeWindow = '1h') {
    return this.healthMonitor.getHistoricalStats(timeWindow);
  }

  // Configuration analysis
  suggestOptimalLimits() {
    return this.configAnalyzer.suggestOptimalLimits();
  }
}

module.exports = LLMStatsManager;