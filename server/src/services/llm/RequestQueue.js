const logger = require('../logger/Logger');

class RequestQueue {
  constructor() {
    this.queues = new Map(); // requestType -> queue array
    this.activeRequests = new Map(); // requestType -> count
    this.concurrencyLimits = new Map(); // requestType -> limit
    this.globalConcurrencyLimit = 1; // Global limit across all types
    this.activeGlobalRequests = 0;
    this.requestId = 0;
    
    // Initialize default queue types
    this.initializeQueues();
    
    logger.info('RequestQueue initialized', { 
      source: 'llm',
      globalLimit: this.globalConcurrencyLimit
    });
  }

  initializeQueues() {
    // Default request types with their concurrency limits
    const defaultTypes = {
      'message_response': 1,    // Discord message responses
      'character_generation': 1, // Character response generation
      'custom_prompt': 1        // Custom prompts
    };

    for (const [type, limit] of Object.entries(defaultTypes)) {
      this.queues.set(type, []);
      this.activeRequests.set(type, 0);
      this.concurrencyLimits.set(type, limit);
    }
  }

  async enqueue(requestType, requestData, processor) {
    const requestId = ++this.requestId;
    
    logger.debug('Request enqueued', {
      source: 'llm',
      requestId,
      requestType,
      queueLength: this.queues.get(requestType)?.length || 0,
      activeRequests: this.activeRequests.get(requestType) || 0,
      globalActive: this.activeGlobalRequests
    });

    return new Promise((resolve, reject) => {
      const request = {
        id: requestId,
        type: requestType,
        data: requestData,
        processor,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Add to appropriate queue
      if (!this.queues.has(requestType)) {
        this.queues.set(requestType, []);
        this.activeRequests.set(requestType, 0);
        this.concurrencyLimits.set(requestType, 1); // Default limit
      }

      this.queues.get(requestType).push(request);
      
      // Try to process immediately
      this.processNext();
    });
  }

  processNext() {
    // Check if we can process any requests
    if (this.activeGlobalRequests >= this.globalConcurrencyLimit) {
      return; // Global limit reached
    }

    // Find next request to process
    for (const [requestType, queue] of this.queues) {
      if (queue.length === 0) continue;
      
      const activeCount = this.activeRequests.get(requestType) || 0;
      const limit = this.concurrencyLimits.get(requestType) || 1;
      
      if (activeCount < limit) {
        const request = queue.shift();
        this.executeRequest(request);
        return; // Process one at a time
      }
    }
  }

  async executeRequest(request) {
    const { id, type, data, processor, resolve, reject } = request;
    
    // Update counters
    this.activeRequests.set(type, (this.activeRequests.get(type) || 0) + 1);
    this.activeGlobalRequests++;
    
    const startTime = Date.now();
    
    logger.info('Request processing started', {
      source: 'llm',
      requestId: id,
      requestType: type,
      activeRequests: this.activeRequests.get(type),
      globalActive: this.activeGlobalRequests
    });

    try {
      const result = await processor(data);
      
      const duration = Date.now() - startTime;
      
      logger.success('Request completed successfully', {
        source: 'llm',
        requestId: id,
        requestType: type,
        duration: `${duration}ms`
      });
      
      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Request failed', {
        source: 'llm',
        requestId: id,
        requestType: type,
        duration: `${duration}ms`,
        error: error.message
      });
      
      reject(error);
    } finally {
      // Update counters
      this.activeRequests.set(type, (this.activeRequests.get(type) || 1) - 1);
      this.activeGlobalRequests--;
      
      // Process next request
      this.processNext();
    }
  }

  // Configuration methods
  setConcurrencyLimit(requestType, limit) {
    this.concurrencyLimits.set(requestType, limit);
    
    logger.info('Concurrency limit updated', {
      source: 'llm',
      requestType,
      newLimit: limit
    });
    
    // Try to process queued requests with new limit
    this.processNext();
  }

  setGlobalConcurrencyLimit(limit) {
    this.globalConcurrencyLimit = limit;
    
    logger.info('Global concurrency limit updated', {
      source: 'llm',
      newLimit: limit
    });
    
    // Try to process queued requests with new limit
    this.processNext();
  }

  // Status methods
  getQueueStats() {
    const stats = {
      global: {
        active: this.activeGlobalRequests,
        limit: this.globalConcurrencyLimit
      },
      types: {}
    };

    for (const [type, queue] of this.queues) {
      stats.types[type] = {
        queued: queue.length,
        active: this.activeRequests.get(type) || 0,
        limit: this.concurrencyLimits.get(type) || 1
      };
    }

    return stats;
  }

  getQueueLength(requestType) {
    return this.queues.get(requestType)?.length || 0;
  }

  getTotalQueueLength() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  // Health check
  isHealthy() {
    const totalQueued = this.getTotalQueueLength();
    const maxHealthyQueue = 10; // Configurable threshold
    
    return {
      healthy: totalQueued < maxHealthyQueue,
      totalQueued,
      activeGlobal: this.activeGlobalRequests,
      maxQueue: maxHealthyQueue
    };
  }
}

module.exports = RequestQueue;