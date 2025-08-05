const express = require('express');
const router = express.Router();
const storage = require('../../utils/storage');
const { validateLLMSettings, sanitizeLLMSettings } = require('./validators/llmValidator');

// Get LLM settings
router.get('/', (req, res) => {
  try {
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};
    
    // Include both legacy and multi-model settings in response
    const responseData = {
      // Legacy settings
      provider: llmSettings.provider,
      model: llmSettings.model,
      api_key: llmSettings.api_key,
      systemPrompt: llmSettings.systemPrompt,
      temperature: llmSettings.temperature,
      top_p: llmSettings.top_p,
      top_k: llmSettings.top_k,
      frequency_penalty: llmSettings.frequency_penalty,
      presence_penalty: llmSettings.presence_penalty,
      repetition_penalty: llmSettings.repetition_penalty,
      min_p: llmSettings.min_p,
      max_characters: llmSettings.max_characters,
      context_limit: llmSettings.context_limit,
      max_tokens: llmSettings.max_tokens,
      
      // Multi-model settings
      decision_provider: llmSettings.decision_provider,
      decision_model: llmSettings.decision_model,
      decision_api_key: llmSettings.decision_api_key,
      decision_temperature: llmSettings.decision_temperature,
      decision_max_tokens: llmSettings.decision_max_tokens,
      
      conversation_provider: llmSettings.conversation_provider,
      conversation_model: llmSettings.conversation_model,
      conversation_api_key: llmSettings.conversation_api_key,
      conversation_temperature: llmSettings.conversation_temperature,
      conversation_max_tokens: llmSettings.conversation_max_tokens,
      
      // Image settings
      image_provider: llmSettings.image_provider,
      image_model: llmSettings.image_model,
      image_api_key: llmSettings.image_api_key,
      image_max_size: llmSettings.image_max_size,
      image_quality: llmSettings.image_quality
    };
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting LLM settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LLM settings'
    });
  }
});

// Update LLM settings
router.put('/', (req, res) => {
  try {
    const { llm: newLLMSettings } = req.body;
    
    if (!newLLMSettings) {
      return res.status(400).json({
        success: false,
        error: 'LLM settings are required'
      });
    }

    // Validate the settings
    const validationErrors = validateLLMSettings(newLLMSettings);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid LLM settings',
        details: validationErrors
      });
    }

    // Sanitize the settings
    const sanitizedSettings = sanitizeLLMSettings(newLLMSettings);
    
    // Get current settings and update LLM section
    const currentSettings = storage.getSettings();
    const updatedSettings = {
      ...currentSettings,
      llm: {
        ...currentSettings.llm,
        ...sanitizedSettings
      }
    };

    // Save the updated settings
    storage.saveSettings(updatedSettings);

    console.log('LLM settings updated successfully:', {
      fieldsUpdated: Object.keys(sanitizedSettings),
      hasDecisionModel: !!(sanitizedSettings.decision_model),
      hasConversationModel: !!(sanitizedSettings.conversation_model),
      hasImageSettings: !!(sanitizedSettings.image_provider)
    });

    // Broadcast settings update via socket if available
    try {
      const socketManager = require('../../socket/socketManager');
      if (socketManager && socketManager.broadcastToAll) {
        socketManager.broadcastToAll('settingsUpdated', {
          type: 'llm',
          settings: sanitizedSettings,
          timestamp: new Date().toISOString()
        });
      }
    } catch (socketError) {
      console.warn('Could not broadcast settings update:', socketError.message);
    }

    res.json({
      success: true,
      message: 'LLM settings updated successfully',
      data: sanitizedSettings
    });

  } catch (error) {
    console.error('Error updating LLM settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update LLM settings'
    });
  }
});

// Reset LLM settings to defaults
router.post('/reset', (req, res) => {
  try {
    const defaultLLMSettings = {
      // Legacy defaults
      provider: 'featherless',
      model: '',
      api_key: '',
      systemPrompt: '',
      temperature: 0.6,
      top_p: 1,
      repetition_penalty: 1,
      max_characters: 2000,
      context_limit: 4096,
      
      // Multi-model defaults
      decision_provider: 'featherless',
      decision_model: 'zai-org/GLM-4-9B-0414',
      decision_api_key: '',
      decision_temperature: 0.3,
      decision_max_tokens: 200,
      
      conversation_provider: 'featherless',
      conversation_model: 'moonshotai/Kimi-K2-Instruct',
      conversation_api_key: '',
      conversation_temperature: 0.7,
      conversation_max_tokens: 2000,
      
      // Image defaults
      image_provider: '',
      image_model: '',
      image_api_key: '',
      image_max_size: 5,
      image_quality: 2
    };

    const currentSettings = storage.getSettings();
    const updatedSettings = {
      ...currentSettings,
      llm: defaultLLMSettings
    };

    storage.saveSettings(updatedSettings);

    console.log('LLM settings reset to defaults');

    // Broadcast reset via socket
    try {
      const socketManager = require('../../socket/socketManager');
      if (socketManager && socketManager.broadcastToAll) {
        socketManager.broadcastToAll('settingsReset', {
          type: 'llm',
          settings: defaultLLMSettings,
          timestamp: new Date().toISOString()
        });
      }
    } catch (socketError) {
      console.warn('Could not broadcast settings reset:', socketError.message);
    }

    res.json({
      success: true,
      message: 'LLM settings reset to defaults',
      data: defaultLLMSettings
    });

  } catch (error) {
    console.error('Error resetting LLM settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset LLM settings'
    });
  }
});

// Get model info for debugging
router.get('/model-info', (req, res) => {
  try {
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};
    
    const modelInfo = {
      legacy: {
        provider: llmSettings.provider || 'not set',
        model: llmSettings.model || 'not set',
        hasApiKey: !!(llmSettings.api_key)
      },
      decision: {
        provider: llmSettings.decision_provider || 'not set',
        model: llmSettings.decision_model || 'not set',
        hasApiKey: !!(llmSettings.decision_api_key),
        temperature: llmSettings.decision_temperature || 'not set',
        maxTokens: llmSettings.decision_max_tokens || 'not set'
      },
      conversation: {
        provider: llmSettings.conversation_provider || 'not set',
        model: llmSettings.conversation_model || 'not set',
        hasApiKey: !!(llmSettings.conversation_api_key),
        temperature: llmSettings.conversation_temperature || 'not set',
        maxTokens: llmSettings.conversation_max_tokens || 'not set'
      },
      image: {
        provider: llmSettings.image_provider || 'not set',
        model: llmSettings.image_model || 'not set',
        hasApiKey: !!(llmSettings.image_api_key)
      }
    };
    
    res.json({
      success: true,
      data: modelInfo
    });
  } catch (error) {
    console.error('Error getting model info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model info'
    });
  }
});

module.exports = router;