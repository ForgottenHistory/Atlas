const express = require('express');
const router = express.Router();
const storage = require('../../utils/storage');
const { validateLLMSettings } = require('./validators/llmValidator');

// GET /api/settings/llm
router.get('/', async (req, res) => {
  try {
    const llmSettings = storage.getLLMSettings();
    
    res.json({
      success: true,
      data: llmSettings
    });
  } catch (error) {
    console.error('Error getting LLM settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LLM settings'
    });
  }
});

// POST /api/settings/llm
router.post('/', async (req, res) => {
  try {
    const llmSettings = req.body;
    
    const validated = validateLLMSettings(llmSettings);
    if (validated.error) {
      return res.status(400).json({
        success: false,
        error: validated.error
      });
    }
    
    const success = await storage.updateLLMSettings(validated.settings);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save LLM settings'
      });
    }
    
    // Add activity log
    await storage.addActivity('LLM configuration updated');
    
    res.json({
      success: true,
      message: 'LLM settings updated successfully',
      data: storage.getLLMSettings()
    });
  } catch (error) {
    console.error('Error updating LLM settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update LLM settings'
    });
  }
});

// POST /api/settings/llm/reset
router.post('/reset', async (req, res) => {
  try {
    const success = await storage.resetLLMSettings();
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to reset LLM settings'
      });
    }
    
    // Add activity log
    await storage.addActivity('LLM settings reset to defaults');
    
    res.json({
      success: true,
      message: 'LLM settings reset successfully',
      data: storage.getLLMSettings()
    });
  } catch (error) {
    console.error('Error resetting LLM settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset LLM settings'
    });
  }
});

module.exports = router;