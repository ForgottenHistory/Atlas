const express = require('express');
const router = express.Router();

// GET /api/persona
router.get('/', (req, res) => {
  // Import botData from bot routes
  const { botData } = require('./bot');
  
  res.json({
    success: true,
    data: botData.persona
  });
});

// POST /api/persona
router.post('/', (req, res) => {
  const { name, description } = req.body;
  
  if (!name || !description) {
    return res.status(400).json({
      success: false,
      error: 'Name and description are required'
    });
  }
  
  // Import botData from bot routes
  const { botData } = require('./bot');
  
  botData.persona = {
    name: name.trim(),
    description: description.trim()
  };
  
  // Add activity log
  const activity = {
    id: Date.now(),
    message: `Persona updated: ${name}`,
    timestamp: 'Just now'
  };
  botData.recentActivity.unshift(activity);
  botData.recentActivity = botData.recentActivity.slice(0, 10);
  
  res.json({
    success: true,
    message: 'Persona updated successfully',
    data: botData.persona
  });
});

// PUT /api/persona
router.put('/', (req, res) => {
  const { name, description } = req.body;
  
  // Import botData from bot routes
  const { botData } = require('./bot');
  
  if (name !== undefined) botData.persona.name = name.trim();
  if (description !== undefined) botData.persona.description = description.trim();
  
  res.json({
    success: true,
    message: 'Persona updated successfully',
    data: botData.persona
  });
});

module.exports = router;