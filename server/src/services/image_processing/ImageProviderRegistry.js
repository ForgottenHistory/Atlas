const logger = require('../logger/Logger');

class ImageProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.registerProviders();
  }

  registerProviders() {
    try {
      const OpenRouterProvider = require('../llm/providers/OpenRouterProvider');
      this.providers.set('openrouter', new OpenRouterProvider());

      logger.debug('Image providers registered', {
        source: 'imageProcessing',
        providers: Array.from(this.providers.keys())
      });
    } catch (error) {
      logger.error('Failed to register image providers', {
        source: 'imageProcessing',
        error: error.message
      });
    }
  }

  getProvider(providerName) {
    return this.providers.get(providerName);
  }

  hasProvider(providerName) {
    return this.providers.has(providerName);
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  getProviderInfo() {
    const info = {};
    for (const [name, provider] of this.providers) {
      info[name] = provider.getInfo();
    }
    return info;
  }

  validateProvider(providerName, settings) {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return { isValid: false, error: `Provider '${providerName}' not available` };
    }

    const validationErrors = provider.validateSettings(settings);
    if (validationErrors.length > 0) {
      return { isValid: false, error: `Invalid settings: ${validationErrors.join(', ')}` };
    }

    return { isValid: true };
  }
}

module.exports = ImageProviderRegistry;