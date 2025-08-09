const storage = require('../../utils/storage');

class ImageConfigManager {
  getImageSettings() {
    // FIX: Use main settings instead of separate LLM settings
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};

    return {
      enabled: !!(llmSettings.image_provider && llmSettings.image_model && llmSettings.image_api_key),
      provider: llmSettings.image_provider,
      model: llmSettings.image_model,
      api_key: llmSettings.image_api_key,
      maxSize: llmSettings.image_max_size || 5,
      quality: llmSettings.image_quality || 2,
      gifFrameCount: llmSettings.gif_frame_count || 2
    };
  }

  getDefaultSettings() {
    return {
      provider: '',
      model: '',
      api_key: '',
      maxSize: 5,
      quality: 2,
      gifFrameCount: 2
    };
  }

  validateSettings(settings) {
    if (!settings) return false;
    if (!settings.provider || !settings.api_key) return false;
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
      api_key: settings.api_key,
      model: settings.model,
      quality: settings.quality,
      maxSize: settings.maxSize
    };
  }

  updateImageSettings(newSettings) {
    // This would integrate with the storage system to update LLM settings
    // For now, just validate the format
    const requiredFields = ['provider', 'model', 'api_key'];
    const missingFields = requiredFields.filter(field => !newSettings[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return true;
  }
}

module.exports = ImageConfigManager;