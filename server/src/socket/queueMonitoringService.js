const LLMServiceSingleton = require('../services/llm/LLMServiceSingleton');
const logger = require('../services/logger/Logger');

class QueueMonitoringService {
  constructor(io) {
    this.io = io;
    this.llmService = LLMServiceSingleton.getInstance();
    this.periodicInterval = null;
  }

  startMonitoring() {
    this.setupRealTimeListener();
    this.startPeriodicUpdates();
  }

  setupRealTimeListener() {
    // Listen to real-time queue stats from the singleton LLM service
    this.llmService.requestQueue.addStatsListener(({ stats, health }) => {
      logger.debug('Queue stats listener triggered', {
        source: 'system',
        totalQueued: health.totalQueued,
        activeGlobal: health.activeGlobal,
        hasActivity: Object.values(stats.types).some(type => type.queued > 0 || type.active > 0)
      });
      
      // Broadcast queue updates to all connected clients
      this.broadcastQueueUpdate(stats, health);
      
      // Log significant queue events
      this.logQueueActivity(stats, health);
    });
  }

  startPeriodicUpdates() {
    // Periodically broadcast current queue stats (as backup)
    this.periodicInterval = setInterval(() => {
      const stats = this.llmService.getQueueStats();
      const health = this.llmService.getQueueHealth();
      
      const hasActivity = Object.values(stats.types).some(type => 
        type.queued > 0 || type.active > 0
      );
      
      if (hasActivity) {
        this.broadcastQueueUpdate(stats, health);
      }
    }, 1000); // Every second
  }

  broadcastQueueUpdate(stats, health) {
    this.io.emit('queueUpdate', {
      stats,
      health,
      timestamp: new Date().toISOString()
    });
  }

  logQueueActivity(stats, health) {
    const hasActivity = Object.values(stats.types).some(type => 
      type.queued > 0 || type.active > 0
    );
  }

  stopMonitoring() {
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }
  }
}

module.exports = QueueMonitoringService;