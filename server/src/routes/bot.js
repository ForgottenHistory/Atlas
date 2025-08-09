const express = require('express');
const discordService = require('../services/discord');
const logger = require('../services/logger/Logger');
const storage = require('../utils/storage');
const LLMServiceSingleton = require('../services/llm/LLMServiceSingleton');

const router = express.Router();

// === UTILITY FUNCTIONS FOR SOCKET SYSTEM ===

// Runtime data storage for socket system
let runtimeData = {
  isConnected: false,
  activeUsers: 0,
  messagesToday: 0,
  uptime: Date.now()
};

/**
 * Get current runtime data
 */
function getRuntimeData() {
  return { ...runtimeData };
}

/**
 * Update runtime data
 */
function updateRuntimeData(updates) {
  runtimeData = { ...runtimeData, ...updates };
}

/**
 * Get comprehensive bot data
 */
async function getBotData() {
  const llmService = LLMServiceSingleton.getInstance();
  const discordStatus = discordService.getStatus();
  const recentActivity = storage.getRecentActivity();
  
  return {
    isConnected: discordStatus.isConnected || runtimeData.isConnected,
    activeUsers: runtimeData.activeUsers,
    messagesToday: runtimeData.messagesToday,
    uptime: Math.floor((Date.now() - runtimeData.uptime) / 1000), // seconds
    recentActivity: recentActivity,
    queueStats: llmService.getQueueStats(),
    queueHealth: llmService.getQueueHealth(),
    discordUser: discordStatus.username,
    guilds: discordStatus.guilds
  };
}

// === EXISTING BOT ROUTES (unchanged) ===

// Get bot status
router.get('/status', (req, res) => {
  try {
    const status = discordService.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    logger.error('Failed to get bot status', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connect bot
router.post('/connect', async (req, res) => {
  try {
    const result = await discordService.initialize();
    if (result) {
      res.json({ success: true, message: 'Bot connected successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to connect bot' });
    }
  } catch (error) {
    logger.error('Failed to connect bot', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect bot
router.post('/disconnect', async (req, res) => {
  try {
    await discordService.disconnect();
    res.json({ success: true, message: 'Bot disconnected successfully' });
  } catch (error) {
    logger.error('Failed to disconnect bot', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get servers
router.get('/servers', (req, res) => {
  try {
    if (!discordService.isReady()) {
      return res.status(400).json({ success: false, error: 'Bot is not connected' });
    }
    
    const servers = discordService.getServers();
    res.json({ success: true, servers });
  } catch (error) {
    logger.error('Failed to get servers', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get channels for a server
router.get('/servers/:serverId/channels', (req, res) => {
  try {
    if (!discordService.isReady()) {
      return res.status(400).json({ success: false, error: 'Bot is not connected' });
    }
    
    const { serverId } = req.params;
    const channels = discordService.getChannels(serverId);
    res.json({ success: true, channels });
  } catch (error) {
    logger.error('Failed to get channels', {
      source: 'api',
      serverId: req.params.serverId,
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update active channels
router.post('/servers/:serverId/channels/active', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { channelIds } = req.body;
    
    const result = await discordService.updateActiveChannels(serverId, channelIds);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Failed to update active channels', {
      source: 'api',
      serverId: req.params.serverId,
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active channels
router.get('/channels/active', (req, res) => {
  try {
    const activeChannels = discordService.getActiveChannels();
    res.json({ success: true, activeChannels });
  } catch (error) {
    logger.error('Failed to get active channels', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stats
router.get('/stats', (req, res) => {
  try {
    const stats = discordService.getComprehensiveStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Failed to get bot stats', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// === NEW PLUGIN SYSTEM ROUTES ===

// Get plugin system status
router.get('/plugins/status', (req, res) => {
  try {
    const status = discordService.getPluginSystemStatus();
    res.json({ success: true, status });
  } catch (error) {
    logger.error('Failed to get plugin system status', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enable plugin system
router.post('/plugins/enable', async (req, res) => {
  try {
    const result = await discordService.enablePluginSystem();
    
    if (result.success) {
      logger.info('Plugin system enabled via API', {
        source: 'api',
        deferred: result.deferred
      });
    }
    
    res.json({ 
      success: result.success, 
      message: result.message,
      deferred: result.deferred
    });
  } catch (error) {
    logger.error('Failed to enable plugin system', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disable plugin system (use legacy mode)
router.post('/plugins/disable', (req, res) => {
  try {
    const result = discordService.disablePluginSystem();
    
    logger.info('Plugin system disabled via API', {
      source: 'api'
    });
    
    res.json({ 
      success: result.success, 
      message: result.message 
    });
  } catch (error) {
    logger.error('Failed to disable plugin system', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available tools (both legacy and plugin-based)
router.get('/tools', (req, res) => {
  try {
    const tools = discordService.getAvailableTools();
    res.json({ success: true, tools });
  } catch (error) {
    logger.error('Failed to get available tools', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tool statistics
router.get('/tools/stats', (req, res) => {
  try {
    const stats = discordService.getToolStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Failed to get tool stats', {
      source: 'api',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test plugin system manually (for development)
router.post('/plugins/test/:pluginName', async (req, res) => {
  try {
    if (!discordService.isUsingPluginSystem()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Plugin system is not active' 
      });
    }

    const { pluginName } = req.params;
    const { context } = req.body;

    // This would require access to the PluginSystem directly
    // For now, return a placeholder response
    res.json({ 
      success: true, 
      message: `Plugin test endpoint for ${pluginName}`,
      note: 'Manual plugin testing not yet implemented in this integration'
    });
  } catch (error) {
    logger.error('Failed to test plugin', {
      source: 'api',
      plugin: req.params.pluginName,
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get conversation history (unchanged)
router.get('/conversations/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const history = discordService.getConversationHistory(channelId);
    res.json({ success: true, history });
  } catch (error) {
    logger.error('Failed to get conversation history', {
      source: 'api',
      channelId: req.params.channelId,
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear conversation history (unchanged)
router.delete('/conversations/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const result = discordService.clearConversationHistory(channelId);
    res.json({ success: result, message: result ? 'History cleared' : 'Failed to clear history' });
  } catch (error) {
    logger.error('Failed to clear conversation history', {
      source: 'api',
      channelId: req.params.channelId,
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { 
  router,
  // Export utility functions for socket system
  getBotData,
  getRuntimeData,
  updateRuntimeData
};