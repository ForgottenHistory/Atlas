const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');
const LLMServiceSingleton = require('../services/llm/LLMServiceSingleton');

// Initialize LLM service singleton for queue monitoring
const llmService = LLMServiceSingleton.getInstance();

// In-memory data that doesn't need persistence (real-time stats)
let runtimeData = {
  isConnected: false,
  activeUsers: 1234,
  messagesToday: 5678,
  uptime: 99.9
};

// Initialize storage on first load
let storageInitialized = false;
const initStorage = async () => {
  if (!storageInitialized) {
    // Storage is initialized at app startup, just load saved stats
    const savedStats = storage.getStats();
    runtimeData = { ...runtimeData, ...savedStats };
    storageInitialized = true;
  }
};

// Combined data getter
const getBotData = async () => {
  await initStorage();
  
  return {
    isConnected: runtimeData.isConnected,
    activeUsers: runtimeData.activeUsers,
    messagesToday: runtimeData.messagesToday,
    uptime: runtimeData.uptime,
    persona: storage.getPersona(),
    settings: storage.getSettings(),
    recentActivity: storage.getRecentActivity(),
    queueStats: llmService.getQueueStats(),
    queueHealth: llmService.getQueueHealth()
  };
};

// GET /api/bot/status
router.get('/status', async (req, res) => {
  try {
    const data = await getBotData();
    
    res.json({
      success: true,
      data: {
        isConnected: data.isConnected,
        activeUsers: data.activeUsers,
        messagesToday: data.messagesToday,
        uptime: data.uptime,
        queueStats: data.queueStats,
        queueHealth: data.queueHealth
      }
    });
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bot status'
    });
  }
});

// GET /api/bot/queue
router.get('/queue', async (req, res) => {
  try {
    const queueStats = llmService.getQueueStats();
    const queueHealth = llmService.getQueueHealth();
    
    res.json({
      success: true,
      data: {
        stats: queueStats,
        health: queueHealth,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics'
    });
  }
});

// POST /api/bot/queue/config
router.post('/queue/config', async (req, res) => {
  try {
    const { globalLimit, typeLimit, requestType } = req.body;
    
    if (globalLimit !== undefined) {
      llmService.setGlobalConcurrencyLimit(globalLimit);
      await storage.addActivity(`Queue global limit updated to ${globalLimit}`);
    }
    
    if (typeLimit !== undefined && requestType) {
      llmService.setQueueConcurrencyLimit(requestType, typeLimit);
      await storage.addActivity(`Queue limit for ${requestType} updated to ${typeLimit}`);
    }
    
    res.json({
      success: true,
      data: {
        stats: llmService.getQueueStats(),
        message: 'Queue configuration updated'
      }
    });
  } catch (error) {
    console.error('Error updating queue config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update queue configuration'
    });
  }
});

// POST /api/bot/toggle
router.post('/toggle', async (req, res) => {
  try {
    await initStorage();
    
    runtimeData.isConnected = !runtimeData.isConnected;
    
    // Add activity log
    const activity = await storage.addActivity(
      `Bot ${runtimeData.isConnected ? 'connected' : 'disconnected'}`
    );
    
    res.json({
      success: true,
      data: {
        isConnected: runtimeData.isConnected,
        activity
      }
    });
  } catch (error) {
    console.error('Error toggling bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle bot connection'
    });
  }
});

// GET /api/bot/activity
router.get('/activity', async (req, res) => {
  try {
    await initStorage();
    
    res.json({
      success: true,
      data: storage.getRecentActivity()
    });
  } catch (error) {
    console.error('Error getting activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity'
    });
  }
});

// POST /api/bot/activity
router.post('/activity', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    await initStorage();
    const activity = await storage.addActivity(message);
    
    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error adding activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add activity'
    });
  }
});

// Export both router and data getter for socket.io
module.exports = { 
  router, 
  getBotData,
  getRuntimeData: () => runtimeData,
  updateRuntimeData: (updates) => {
    runtimeData = { ...runtimeData, ...updates };
  }
};