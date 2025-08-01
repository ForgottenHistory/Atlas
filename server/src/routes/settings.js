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
        hasBotToken: !!settings.botToken
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
    const { botToken, commandPrefix } = req.body;
    
    let updated = [];
    const updates = {};
    
    if (botToken !== undefined) {
      updates.botToken = botToken.trim();
      updated.push('bot token');
    }
    
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
    await storage.addActivity(`Settings updated: ${updated.join(', ')}`);
    
    const settings = storage.getSettings();
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        commandPrefix: settings.commandPrefix,
        hasBotToken: !!settings.botToken
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
      commandPrefix: '!'
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
        hasBotToken: false
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