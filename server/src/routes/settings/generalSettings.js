const express = require('express');
const router = express.Router();
const storage = require('../../utils/storage');

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

// POST /api/settings - Update general bot settings
router.post('/', async (req, res) => {
  try {
    const { botToken, commandPrefix } = req.body;
    
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
    await storage.addActivity(`Bot settings updated: ${updated.join(', ')}`);
    
    const settings = storage.getSettings();
    
    res.json({
      success: true,
      message: 'Bot settings updated successfully',
      data: {
        commandPrefix: settings.commandPrefix,
        hasBotToken: !!settings.botToken,
        llm: settings.llm || {}
      }
    });
  } catch (error) {
    console.error('Error updating bot settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bot settings'
    });
  }
});

// POST /api/settings/reset - Reset all settings to defaults
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
    await storage.addActivity('All settings reset to defaults');
    
    res.json({
      success: true,
      message: 'All settings reset successfully',
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

module.exports = router;