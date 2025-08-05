const FeatherlessProvider = require('./providers/FeatherlessProvider');
const OpenRouterProvider = require('./providers/OpenRouterProvider');

class LLMClient {
  constructor() {
    this.providers = new Map();
    this.currentProvider = 'featherless'; // Default provider

    // Initialize available providers
    this.initializeProviders();
  }

  initializeProviders() {
    // Add Featherless provider
    const featherless = new FeatherlessProvider();
    if (featherless.isAvailable()) {
      this.providers.set('featherless', featherless);
      console.log('Featherless provider initialized');
    } else {
      console.warn('Featherless provider not available');
    }

    // Add OpenRouter provider
    const openrouter = new OpenRouterProvider();
    this.providers.set('openrouter', openrouter);
    console.log('OpenRouter provider initialized');
  }

  async generateResponse(prompt, settings = {}) {
    // Use provider from settings if provided, otherwise use current provider
    const providerName = settings.provider || this.currentProvider;
    const provider = this.providers.get(providerName);

    console.log('Selected provider:', providerName, 'Available:', !!provider);

    if (!provider) {
      throw new Error(`Provider '${providerName}' not available`);
    }

    // For OpenRouter, we need the API key in settings
    if (providerName === 'openrouter' && !settings.api_key) {
      throw new Error('OpenRouter API key required in settings');
    }

    // For Featherless, check if we have API key in settings or environment
    if (providerName === 'featherless') {
      const hasEnvKey = process.env.FEATHERLESS_API_KEY;
      const hasSettingsKey = settings.api_key;

      if (!hasEnvKey && !hasSettingsKey) {
        throw new Error('Featherless API key required - please provide in settings or environment variables');
      }
    }

    // Validate settings for the provider - only if provider has validation
    if (provider.validateSettings) {
      const validationErrors = provider.validateSettings(settings);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid settings: ${validationErrors.join(', ')}`);
      }
    }

    try {
      return await provider.generateResponse(prompt, settings);
    } catch (error) {
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  // Provider management
  setProvider(providerName) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider '${providerName}' not available`);
    }
    this.currentProvider = providerName;
    console.log(`Switched to provider: ${providerName}`);
  }

  getCurrentProvider() {
    return this.currentProvider;
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  getProviderInfo(providerName = this.currentProvider) {
    const provider = this.providers.get(providerName);
    return provider ? provider.getInfo() : null;
  }

  getAllProviderInfo() {
    const info = {};
    for (const [name, provider] of this.providers) {
      info[name] = provider.getInfo();
    }
    return info;
  }

  isProviderAvailable(providerName) {
    return this.providers.has(providerName);
  }

  // Method to get models for a specific provider
  async getModelsForProvider(providerName, apiKey = null) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not available`);
    }

    if (!provider.fetchAvailableModels) {
      throw new Error(`Provider '${providerName}' does not support model fetching`);
    }

    if (providerName === 'openrouter') {
      if (!apiKey) {
        throw new Error('API key required for OpenRouter');
      }
      return await provider.fetchAvailableModels(apiKey);
    } else {
      return await provider.fetchAvailableModels();
    }
  }
}

module.exports = LLMClient;