const storage = require('../../utils/storage');

class ImageConfigManager {
  getImageSettings() {
    const llmSettings = storage.getLLMSettings();

    return {
      enabled: !!(llmSettings.image_provider && llmSettings.image_model && llmSettings.image_api_key),
      provider: llmSettings.image_provider,
      model: llmSettings.image_model,
      apiKey: llmSettings.image_api_key,
      maxSize: llmSettings.image_max_size || 5,
      quality: llmSettings.image_quality || 2
    };
  }

  validateSettings(settings) {
    if (!settings) return false;
    if (!settings.provider || !settings.apiKey) return false;
    return true;
  }

  isImageProcessingEnabled() {
    const settings = this.getImageSettings();
    return settings.enabled;
  }

  getProviderConfig(providerName) {
    const settings = this.getImageSettings();
    
    if (settings.provider !== providerName) {
      return null;
    }

    return {
      apiKey: settings.apiKey,
      model: settings.model,
      quality: settings.quality,
      maxSize: settings.maxSize
    };
  }

  updateImageSettings(newSettings) {
    // This would integrate with the storage system to update LLM settings
    // For now, just validate the format
    const requiredFields = ['provider', 'model', 'apiKey'];
    const missingFields = requiredFields.filter(field => !newSettings[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return true;
  }

  getDefaultSettings() {
    return {
      provider: '',
      model: '',
      apiKey: '',
      maxSize: 5,
      quality: 2
    };
  }
}

module.exports = ImageConfigManager;