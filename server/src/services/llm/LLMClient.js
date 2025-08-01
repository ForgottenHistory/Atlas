const FeatherlessProvider = require('./providers/FeatherlessProvider');

class LLMClient {
  constructor() {
    this.providers = new Map();
    this.currentProvider = 'featherless';
    
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

    // Future providers can be added here
    // const openai = new OpenAIProvider();
    // if (openai.isAvailable()) {
    //   this.providers.set('openai', openai);
    // }
  }

  async generateResponse(prompt, settings = {}) {
    const provider = this.providers.get(this.currentProvider);
    
    if (!provider) {
      throw new Error(`Provider '${this.currentProvider}' not available`);
    }

    // Validate settings for the current provider
    const validationErrors = provider.validateSettings(settings);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid settings: ${validationErrors.join(', ')}`);
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
}

module.exports = LLMClient;