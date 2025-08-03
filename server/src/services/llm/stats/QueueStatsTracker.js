const logger = require('../../logger/Logger');

class QueueStatsTracker {
  constructor(requestQueue) {
    this.requestQueue = requestQueue;
  }

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

  getQueueUtilization() {
    const stats = this.getQueueStats();
    const health = this.getQueueHealth();
    
    return {
      globalUtilization: (health.activeGlobal / stats.global.limit) * 100,
      typeUtilization: Object.fromEntries(
        Object.entries(stats.types).map(([type, typeStats]) => [
          type,
          (typeStats.active / typeStats.limit) * 100
        ])
      ),
      queueBacklog: health.totalQueued,
      isHealthy: health.healthy
    };
  }

  getQueueTrends() {
    // This would typically store historical data
    // For now, return current snapshot
    const stats = this.getQueueStats();
    const health = this.getQueueHealth();
    
    return {
      timestamp: new Date().toISOString(),
      snapshot: {
        totalQueued: health.totalQueued,
        activeGlobal: health.activeGlobal,
        globalLimit: stats.global.limit,
        typeBreakdown: Object.fromEntries(
          Object.entries(stats.types).map(([type, typeStats]) => [
            type,
            {
              active: typeStats.active,
              queued: typeStats.queued,
              utilization: (typeStats.active / typeStats.limit) * 100
            }
          ])
        )
      }
    };
  }

  getBottlenecks() {
    const stats = this.getQueueStats();
    const bottlenecks = [];
    
    // Check global bottleneck
    if (stats.global.active >= stats.global.limit) {
      bottlenecks.push({
        type: 'global',
        severity: 'high',
        message: 'Global concurrency limit reached',
        current: stats.global.active,
        limit: stats.global.limit
      });
    }
    
    // Check type-specific bottlenecks
    for (const [type, typeStats] of Object.entries(stats.types)) {
      if (typeStats.queued > typeStats.limit * 2) {
        bottlenecks.push({
          type: 'queue_backlog',
          requestType: type,
          severity: 'medium',
          message: `High queue backlog for ${type}`,
          queued: typeStats.queued,
          limit: typeStats.limit
        });
      } else if (typeStats.active >= typeStats.limit) {
        bottlenecks.push({
          type: 'type_limit',
          requestType: type,
          severity: 'medium',
          message: `${type} concurrency limit reached`,
          current: typeStats.active,
          limit: typeStats.limit
        });
      }
    }
    
    return bottlenecks;
  }
}

module.exports = QueueStatsTracker;