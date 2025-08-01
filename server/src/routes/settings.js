const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = storage.getSettings();
    
    // Don't expose the actual bot token
    res.json({
      success: true,
      data: {
        commandPrefix: settings.commandPrefix,
        hasBotToken: !!settings.botToken,
        llm: settings.llm || {}
      }
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings'
    });
  }
});

// POST /api/settings
router.post('/', async (req, res) => {
  try {
    const { botToken, commandPrefix, llm } = req.body;
    
    let updated = [];
    const updates = {};
    
    // Handle bot token
    if (botToken !== undefined) {
      updates.botToken = botToken.trim();
      updated.push('bot token');
    }
    
    // Handle command prefix
    if (commandPrefix !== undefined) {
      if (!commandPrefix.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Command prefix cannot be empty'
        });
      }
      updates.commandPrefix = commandPrefix.trim();
      updated.push('command prefix');
    }
    
    // Handle LLM settings
    if (llm && typeof llm === 'object') {
      const validatedLLM = validateLLMSettings(llm);
      if (validatedLLM.error) {
        return res.status(400).json({
          success: false,
          error: validatedLLM.error
        });
      }
      updates.llm = validatedLLM.settings;
      updated.push('LLM configuration');
    }
    
    if (updated.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No settings provided to update'
      });
    }
    
    // Save settings
    const success = await storage.updateSettings(updates);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save settings'
      });
    }
    
    // Add activity log
    await storage.addActivity(`Settings updated: ${updated.join(', ')}`);
    
    const settings = storage.getSettings();
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        commandPrefix: settings.commandPrefix,
        hasBotToken: !!settings.botToken,
        llm: settings.llm || {}
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

// POST /api/settings/reset
router.post('/reset', async (req, res) => {
  try {
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
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to reset settings'
      });
    }
    
    // Add activity log
    await storage.addActivity('Settings reset to defaults');
    
    res.json({
      success: true,
      message: 'Settings reset successfully',
      data: {
        commandPrefix: '!',
        hasBotToken: false,
        llm: defaultSettings.llm
      }
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset settings'
    });
  }
});

// GET /api/settings/llm
router.get('/llm', async (req, res) => {
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
router.post('/llm', async (req, res) => {
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
router.post('/llm/reset', async (req, res) => {
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

// Validation function for LLM settings
function validateLLMSettings(settings) {
  const validated = {};
  const errors = [];
  
  // Temperature: 0-2
  if (settings.temperature !== undefined) {
    const temp = parseFloat(settings.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      errors.push('Temperature must be between 0 and 2');
    } else {
      validated.temperature = temp;
    }
  }
  
  // Top P: 0.01-1
  if (settings.top_p !== undefined) {
    const topP = parseFloat(settings.top_p);
    if (isNaN(topP) || topP < 0.01 || topP > 1) {
      errors.push('Top P must be between 0.01 and 1');
    } else {
      validated.top_p = topP;
    }
  }
  
  // Top K: -1 or positive integer
  if (settings.top_k !== undefined) {
    const topK = parseInt(settings.top_k);
    if (isNaN(topK) || (topK < -1 || topK === 0)) {
      errors.push('Top K must be -1 or a positive integer');
    } else {
      validated.top_k = topK;
    }
  }
  
  // Frequency Penalty: -2 to 2
  if (settings.frequency_penalty !== undefined) {
    const freqPen = parseFloat(settings.frequency_penalty);
    if (isNaN(freqPen) || freqPen < -2 || freqPen > 2) {
      errors.push('Frequency penalty must be between -2 and 2');
    } else {
      validated.frequency_penalty = freqPen;
    }
  }
  
  // Presence Penalty: -2 to 2
  if (settings.presence_penalty !== undefined) {
    const presPen = parseFloat(settings.presence_penalty);
    if (isNaN(presPen) || presPen < -2 || presPen > 2) {
      errors.push('Presence penalty must be between -2 and 2');
    } else {
      validated.presence_penalty = presPen;
    }
  }
  
  // Repetition Penalty: 0.1-2
  if (settings.repetition_penalty !== undefined) {
    const repPen = parseFloat(settings.repetition_penalty);
    if (isNaN(repPen) || repPen < 0.1 || repPen > 2) {
      errors.push('Repetition penalty must be between 0.1 and 2');
    } else {
      validated.repetition_penalty = repPen;
    }
  }
  
  // Min P: 0-1
  if (settings.min_p !== undefined) {
    const minP = parseFloat(settings.min_p);
    if (isNaN(minP) || minP < 0 || minP > 1) {
      errors.push('Min P must be between 0 and 1');
    } else {
      validated.min_p = minP;
    }
  }
  
  if (errors.length > 0) {
    return { error: errors.join(', ') };
  }
  
  return { settings: validated };
}

module.exports = router;