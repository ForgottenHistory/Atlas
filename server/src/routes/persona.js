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
    const { 
      name, 
      description, 
      mes_example, 
      creator_notes, 
      tags, 
      creator, 
      character_version 
    } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required'
      });
    }
    
    const personaData = {
      name: name.trim(),
      description: description.trim(),
      mes_example: mes_example?.trim() || '',
      creator_notes: creator_notes?.trim() || '',
      tags: Array.isArray(tags) ? tags : [],
      creator: creator?.trim() || '',
      character_version: character_version?.trim() || ''
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
    const { 
      name, 
      description, 
      mes_example, 
      creator_notes, 
      tags, 
      creator, 
      character_version 
    } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (mes_example !== undefined) updates.mes_example = mes_example.trim();
    if (creator_notes !== undefined) updates.creator_notes = creator_notes.trim();
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];
    if (creator !== undefined) updates.creator = creator.trim();
    if (character_version !== undefined) updates.character_version = character_version.trim();
    
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