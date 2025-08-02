const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');
const discordService = require('../services/discord');

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
      character_version,
      updateAvatar,
      avatarImage
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

    // Update bot avatar if requested and Discord bot is connected
    if (updateAvatar && avatarImage) {
      console.log('Avatar update requested:', { 
        updateAvatar, 
        hasAvatarImage: !!avatarImage,
        discordReady: discordService.isReady(),
        discordConnected: discordService.getStatus().isConnected
      });
      
      if (discordService.isReady()) {
        try {
          console.log('Attempting to update bot avatar...');
          await updateBotAvatar(avatarImage, name);
          console.log('Bot avatar updated successfully');
          await storage.addActivity(`Bot avatar updated for character: ${name}`);
        } catch (avatarError) {
          console.error('Failed to update bot avatar:', avatarError);
          await storage.addActivity(`Persona updated but avatar update failed: ${avatarError.message}`);
        }
      } else {
        console.log('Discord bot not ready, skipping avatar update');
        await storage.addActivity(`Persona updated but bot not connected for avatar update`);
      }
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

// Helper function to update bot avatar
async function updateBotAvatar(imageDataUrl, characterName) {
  try {
    console.log('updateBotAvatar called with:', {
      characterName,
      imageDataLength: imageDataUrl?.length,
      isDataUrl: imageDataUrl?.startsWith('data:')
    });

    // Access the internal Discord client through the service
    const internalClient = discordService.client?.client || discordService.client?.getClient?.() || null;
    console.log('Discord client status:', {
      hasInternalClient: !!internalClient,
      hasUser: !!(internalClient && internalClient.user),
      clientReady: internalClient?.readyAt,
      userTag: internalClient?.user?.tag,
      serviceReady: discordService.isReady(),
      serviceStatus: discordService.getStatus()
    });

    if (!internalClient || !internalClient.user) {
      throw new Error('Discord client not ready');
    }

    // Convert data URL to buffer
    console.log('Converting image data URL to buffer...');
    const base64Data = imageDataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid image data URL format');
    }
    
    const imageBuffer = Buffer.from(base64Data, 'base64');
    console.log('Image buffer created:', {
      bufferSize: imageBuffer.length,
      bufferSizeKB: Math.round(imageBuffer.length / 1024)
    });

    // Discord has a file size limit of 8MB for avatars
    if (imageBuffer.length > 8 * 1024 * 1024) {
      throw new Error(`Image too large: ${Math.round(imageBuffer.length / 1024 / 1024)}MB (max 8MB)`);
    }

    // Update the bot's avatar
    console.log('Calling Discord API to update avatar...');
    await internalClient.user.setAvatar(imageBuffer);
    
    console.log(`Bot avatar updated successfully for character: ${characterName}`);
  } catch (error) {
    console.error('Failed to update bot avatar:', {
      error: error.message,
      stack: error.stack,
      characterName
    });
    throw error;
  }
}

module.exports = router;