const LLMRequestHandler = require('./LLMRequestHandler');
const LLMContextManager = require('./LLMContextManager');
const LLMResponseManager = require('./LLMResponseManager');
const LLMStatsManager = require('./LLMStatsManager');
const RequestQueue = require('./RequestQueue');
const logger = require('../logger/Logger');

class LLMService {
  constructor() {
    // Initialize core queue system
    this.requestQueue = new RequestQueue();
    
    // Initialize focused managers
    this.requestHandler = new LLMRequestHandler(this.requestQueue);
    this.contextManager = new LLMContextManager();
    this.responseManager = new LLMResponseManager();
    this.statsManager = new LLMStatsManager(this.requestQueue);
    
    logger.info('LLM Service initialized with modular managers', { 
      source: 'llm',
      components: ['RequestHandler', 'ContextManager', 'ResponseManager', 'StatsManager'],
      queueEnabled: true
    });
  }

  async generateCharacterResponse(context) {
    return await this.requestHandler.processCharacterRequest(
      context,
      this.contextManager,
      this.responseManager
    );
  }

  async generateCustomResponse(prompt, settings = {}) {
    return await this.requestHandler.processCustomRequest(
      { prompt, settings },
      this.responseManager
    );
  }

  // Queue management methods (delegated to stats manager)
  getQueueStats() {
    return this.statsManager.getQueueStats();
  }

  getQueueHealth() {
    return this.statsManager.getQueueHealth();
  }

  setQueueConcurrencyLimit(requestType, limit) {
    this.statsManager.setQueueConcurrencyLimit(requestType, limit);
  }

  setGlobalConcurrencyLimit(limit) {
    this.statsManager.setGlobalConcurrencyLimit(limit);
  }

  // Token usage and analysis methods (delegated to context manager)
  getTokenUsageStats(context) {
    return this.contextManager.getTokenUsageStats(context);
  }

  previewMessageFit(context) {
    return this.contextManager.previewMessageFit(context);
  }

  // Response analysis methods (delegated to response manager)
  validateResponse(response, maxCharacters) {
    return this.responseManager.validateResponse(response, maxCharacters);
  }

  getTruncationInfo(originalLength, finalLength, maxCharacters) {
    return this.responseManager.getTruncationInfo(originalLength, finalLength, maxCharacters);
  }

  // Service health and monitoring
  getServiceHealth() {
    return {
      queue: this.getQueueHealth(),
      providers: this.requestHandler.getProviderHealth(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  // Configuration methods
  updateConfiguration(config) {
    if (config.queue) {
      this.statsManager.updateQueueConfiguration(config.queue);
    }
    
    if (config.providers) {
      this.requestHandler.updateProviderConfiguration(config.providers);
    }
    
    logger.info('LLM Service configuration updated', {
      source: 'llm',
      config: Object.keys(config)
    });
  }
}

module.exports = LLMService;