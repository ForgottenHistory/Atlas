const express = require('express');
const router = express.Router();
const storage = require('../../utils/storage');
const { validateLLMSettings } = require('./validators/llmValidator');
const FeatherlessProvider = require('../../services/llm/providers/FeatherlessProvider');

// Get current settings
router.get('/', async (req, res) => {
  try {
    await storage.init();
    const settings = storage.getSettings();

    // Don't send the actual bot token for security
    const safeSettings = {
      ...settings,
      hasBotToken: !!settings.botToken,
      botToken: undefined
    };

    res.json({
      success: true,
      data: safeSettings
    });
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings'
    });
  }
});

// Update settings
router.post('/', async (req, res) => {
  try {
    await storage.init();

    const updates = {};
    let updated = [];

    // Handle bot token
    if (req.body.botToken !== undefined) {
      updates.botToken = req.body.botToken.trim();
      updated.push('bot token');
    }

    // Handle command prefix
    if (req.body.commandPrefix !== undefined) {
      if (req.body.commandPrefix.trim()) {
        updates.commandPrefix = req.body.commandPrefix.trim();
        updated.push('command prefix');
      } else {
        return res.status(400).json({
          success: false,
          error: 'Command prefix cannot be empty'
        });
      }
    }

    // Handle LLM settings
    if (req.body.llm && typeof req.body.llm === 'object') {
      const llmValidation = validateLLMSettings(req.body.llm);

      if (llmValidation.error) {
        return res.status(400).json({
          success: false,
          error: `LLM validation errors: ${llmValidation.error}`
        });
      }

      updates.llm = llmValidation.settings;
      updated.push('LLM configuration');
    }

    if (updated.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid settings provided'
      });
    }

    const success = await storage.updateSettings(updates);

    if (success) {
      await storage.addActivity(`Settings updated: ${updated.join(', ')}`);
      res.json({
        success: true,
        message: `Updated: ${updated.join(', ')}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save settings'
      });
    }
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Get available LLM models
router.get('/models', async (req, res) => {
  try {
    const featherlessProvider = new FeatherlessProvider();

    if (!featherlessProvider.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Featherless provider not available - check API key configuration'
      });
    }

    const models = await featherlessProvider.fetchAvailableModels();

    res.json({
      success: true,
      data: models,
      provider: 'featherless',
      count: models.length
    });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch available models'
    });
  }
});

// Reset settings to defaults
router.post('/reset', async (req, res) => {
  try {
    await storage.init();

    const defaultSettings = {
      botToken: '',
      commandPrefix: '!',
      llm: {
        temperature: 0.6,
        top_p: 1,
        repetition_penalty: 1
      }
    };

    const success = await storage.updateSettings(defaultSettings);

    if (success) {
      await storage.addActivity('Settings reset to defaults');
      res.json({
        success: true,
        message: 'Settings reset to defaults'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to reset settings'
      });
    }
  } catch (error) {
    console.error('Failed to reset settings:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Get OpenRouter models (requires API key)
router.get('/models/openrouter', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API key required. Provide it in X-API-Key header or apiKey query parameter.'
      });
    }

    const OpenRouterProvider = require('../../llm/providers/OpenRouterProvider');
    const openRouterProvider = new OpenRouterProvider();

    const models = await openRouterProvider.fetchAvailableModels(apiKey);

    res.json({
      success: true,
      data: models,
      provider: 'openrouter',
      count: models.length
    });
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch available models from OpenRouter'
    });
  }
});

module.exports = router;