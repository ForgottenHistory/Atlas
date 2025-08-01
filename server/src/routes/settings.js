const express = require('express');
const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  // Import botData from bot routes
  const { botData } = require('./bot');
  
  // Don't expose the actual bot token
  res.json({
    success: true,
    data: {
      commandPrefix: botData.settings.commandPrefix,
      hasBotToken: !!botData.settings.botToken
    }
  });
});

// POST /api/settings
router.post('/', (req, res) => {
  const { botToken, commandPrefix } = req.body;
  
  // Import botData from bot routes
  const { botData } = require('./bot');
  
  let updated = [];
  
  if (botToken !== undefined) {
    botData.settings.botToken = botToken.trim();
    updated.push('bot token');
  }
  
  if (commandPrefix !== undefined) {
    if (!commandPrefix.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Command prefix cannot be empty'
      });
    }
    botData.settings.commandPrefix = commandPrefix.trim();
    updated.push('command prefix');
  }
  
  if (updated.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No settings provided to update'
    });
  }
  
  // Add activity log
  const activity = {
    id: Date.now(),
    message: `Settings updated: ${updated.join(', ')}`,
    timestamp: 'Just now'
  };
  botData.recentActivity.unshift(activity);
  botData.recentActivity = botData.recentActivity.slice(0, 10);
  
  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: {
      commandPrefix: botData.settings.commandPrefix,
      hasBotToken: !!botData.settings.botToken
    }
  });
});

// POST /api/settings/reset
router.post('/reset', (req, res) => {
  // Import botData from bot routes
  const { botData } = require('./bot');
  
  botData.settings = {
    botToken: '',
    commandPrefix: '!'
  };
  
  // Add activity log
  const activity = {
    id: Date.now(),
    message: 'Settings reset to defaults',
    timestamp: 'Just now'
  };
  botData.recentActivity.unshift(activity);
  botData.recentActivity = botData.recentActivity.slice(0, 10);
  
  res.json({
    success: true,
    message: 'Settings reset successfully',
    data: {
      commandPrefix: botData.settings.commandPrefix,
      hasBotToken: false
    }
  });
});

module.exports = router;