class ImageStatsTracker {
  constructor() {
    this.stats = {
      totalProcessed: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      byProvider: {},
      averageProcessingTime: 0,
      lastProcessedAt: null
    };
  }

  recordSuccess(provider, processingTime) {
    this.updateStats('success', provider, processingTime);
  }

  recordFailure(provider, processingTime) {
    this.updateStats('failed', provider, processingTime);
  }

  updateStats(result, provider, processingTime) {
    this.stats.totalProcessed++;
    this.stats.lastProcessedAt = new Date();

    if (result === 'success') {
      this.stats.successfulAnalyses++;
    } else {
      this.stats.failedAnalyses++;
    }

    // Update provider-specific stats
    if (!this.stats.byProvider[provider]) {
      this.stats.byProvider[provider] = {
        processed: 0,
        successful: 0,
        failed: 0,
        totalTime: 0
      };
    }

    const providerStats = this.stats.byProvider[provider];
    providerStats.processed++;
    providerStats.totalTime += processingTime;

    if (result === 'success') {
      providerStats.successful++;
    } else {
      providerStats.failed++;
    }

    // Update overall average processing time
    this.stats.averageProcessingTime = Object.values(this.stats.byProvider)
      .reduce((total, stats) => total + stats.totalTime, 0) / this.stats.totalProcessed;
  }

  getStats() {
    const processedStats = { ...this.stats };

    // Add computed statistics
    processedStats.successRate = this.stats.totalProcessed > 0
      ? ((this.stats.successfulAnalyses / this.stats.totalProcessed) * 100).toFixed(1) + '%'
      : '0%';

    // Add provider-specific computed stats
    Object.keys(processedStats.byProvider).forEach(provider => {
      const providerStats = processedStats.byProvider[provider];
      providerStats.successRate = providerStats.processed > 0
        ? ((providerStats.successful / providerStats.processed) * 100).toFixed(1) + '%'
        : '0%';
      providerStats.averageTime = providerStats.processed > 0
        ? Math.round(providerStats.totalTime / providerStats.processed) + 'ms'
        : '0ms';
    });

    processedStats.averageProcessingTime = Math.round(processedStats.averageProcessingTime) + 'ms';

    return processedStats;
  }

  reset() {
    this.stats = {
      totalProcessed: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      byProvider: {},
      averageProcessingTime: 0,
      lastProcessedAt: null
    };
  }

  getProviderStats(providerName) {
    return this.stats.byProvider[providerName] || null;
  }
}

module.exports = ImageStatsTracker;