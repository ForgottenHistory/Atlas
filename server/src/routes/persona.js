const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');

// GET /api/persona
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: storage.getPersona()
    });
  } catch (error) {
    console.error('Error getting persona:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get persona'
    });
  }
});

// POST /api/persona
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required'
      });
    }
    
    const personaData = {
      name: name.trim(),
      description: description.trim()
    };
    
    const success = await storage.updatePersona(personaData);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save persona'
      });
    }
    
    // Add activity log
    await storage.addActivity(`Persona updated: ${name}`);
    
    res.json({
      success: true,
      message: 'Persona updated successfully',
      data: storage.getPersona()
    });
  } catch (error) {
    console.error('Error updating persona:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update persona'
    });
  }
});

// PUT /api/persona
router.put('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    
    const success = await storage.updatePersona(updates);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save persona'
      });
    }
    
    res.json({
      success: true,
      message: 'Persona updated successfully',
      data: storage.getPersona()
    });
  } catch (error) {
    console.error('Error updating persona:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update persona'
    });
  }
});

module.exports = router;