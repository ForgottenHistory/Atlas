const express = require('express');
const router = express.Router();

// Mock data - replace with database calls later
let botData = {
  isConnected: false,
  activeUsers: 1234,
  messagesToday: 5678,
  uptime: 99.9,
  persona: {
    name: '',
    description: ''
  },
  settings: {
    botToken: '',
    commandPrefix: '!'
  },
  recentActivity: [
    { id: 1, message: "User interaction in #general", timestamp: "2 minutes ago" },
    { id: 2, message: "Bot started successfully", timestamp: "5 minutes ago" },
    { id: 3, message: "Configuration updated", timestamp: "10 minutes ago" }
  ]
};

// GET /api/bot/status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      isConnected: botData.isConnected,
      activeUsers: botData.activeUsers,
      messagesToday: botData.messagesToday,
      uptime: botData.uptime
    }
  });
});

// POST /api/bot/toggle
router.post('/toggle', (req, res) => {
  botData.isConnected = !botData.isConnected;
  
  // Add activity log
  const activity = {
    id: Date.now(),
    message: `Bot ${botData.isConnected ? 'connected' : 'disconnected'}`,
    timestamp: 'Just now'
  };
  botData.recentActivity.unshift(activity);
  botData.recentActivity = botData.recentActivity.slice(0, 10);
  
  res.json({
    success: true,
    data: {
      isConnected: botData.isConnected,
      activity
    }
  });
});

// GET /api/bot/activity
router.get('/activity', (req, res) => {
  res.json({
    success: true,
    data: botData.recentActivity
  });
});

// POST /api/bot/activity
router.post('/activity', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Message is required'
    });
  }
  
  const activity = {
    id: Date.now(),
    message,
    timestamp: 'Just now'
  };
  
  botData.recentActivity.unshift(activity);
  botData.recentActivity = botData.recentActivity.slice(0, 10);
  
  res.json({
    success: true,
    data: activity
  });
});

module.exports = { router, botData };