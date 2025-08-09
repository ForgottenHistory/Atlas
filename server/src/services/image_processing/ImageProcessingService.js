const ImageProviderRegistry = require('./ImageProviderRegistry');
const ImageAnalyzer = require('./ImageAnalyzer');
const ImageStatsTracker = require('./ImageStatsTracker');
const ImageConfigManager = require('./ImageConfigManager');
const logger = require('../logger/Logger');

class ImageProcessingService {
  constructor() {
    this.providerRegistry = new ImageProviderRegistry();
    this.analyzer = new ImageAnalyzer(this.providerRegistry);
    this.statsTracker = new ImageStatsTracker();
    this.configManager = new ImageConfigManager();

    logger.info('ImageProcessingService initialized', {
      source: 'imageProcessing',
      availableProviders: this.providerRegistry.getAvailableProviders()
    });
  }

  async processMessageImages(message, settings) {
    const startTime = Date.now();

    try {
      // Validate settings
      if (!this.configManager.validateSettings(settings)) {
        logger.warn('Image processing attempted without valid settings', {
          source: 'imageProcessing',
          hasProvider: !!settings.provider,
          hasApiKey: !!settings.api_key
        });
        return null;
      }

      // Extract and analyze images
      const results = await this.analyzer.analyzeMessageImages(message, settings);

      if (results && results.length > 0) {
        this.statsTracker.recordSuccess(settings.provider, Date.now() - startTime);
        return results;
      }

      return null;

    } catch (error) {
      this.statsTracker.recordFailure(settings.provider, Date.now() - startTime);
      logger.error('Error processing Discord message for images', {
        source: 'imageProcessing',
        error: error.message,
        messageId: message.id
      });
      return null;
    }
  }

  // Public API methods
  getStats() {
    return this.statsTracker.getStats();
  }

  isImageProcessingAvailable() {
    const settings = this.configManager.getImageSettings();
    return settings.enabled && this.providerRegistry.hasProvider(settings.provider);
  }

  getAvailableProviders() {
    return this.providerRegistry.getProviderInfo();
  }

  async testImageProcessing(imageUrl, customPrompt) {
    const settings = this.configManager.getImageSettings();
    if (!settings.enabled) {
      throw new Error('Image processing not configured');
    }

    return await this.analyzer.testAnalysis(imageUrl, customPrompt, settings);
  }
}

// Create singleton instance
const imageProcessingService = new ImageProcessingService();
module.exports = imageProcessingService;