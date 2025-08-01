const { getBotData, updateRuntimeData } = require('../routes/bot');
const storage = require('../utils/storage');
const discordService = require('../services/discord');

class SocketHandlers {
  constructor(io) {
    this.io = io;
  }

  // Bot connection handlers
  async handleToggleBotConnection(socket) {
    try {
      const discordStatus = discordService.getStatus();
      
      if (discordStatus.isConnected) {
        // Disconnect bot
        await discordService.disconnect();
        updateRuntimeData({ isConnected: false });
        await storage.addActivity('Bot manually disconnected');
      } else {
        // Connect bot
        const settings = storage.getSettings();
        if (!settings.botToken) {
          socket.emit('botError', { error: 'No bot token configured' });
          return;
        }
        
        const success = await discordService.initialize();
        if (success) {
          updateRuntimeData({ isConnected: true });
          await storage.addActivity('Bot manually connected');
        } else {
          socket.emit('botError', { error: 'Failed to connect bot' });
          return;
        }
      }
      
      // Broadcast updated status
      const botData = await getBotData();
      const newDiscordStatus = discordService.getStatus();
      
      this.io.emit('botStatus', {
        isConnected: newDiscordStatus.isConnected,
        activeUsers: botData.activeUsers,
        messagesToday: botData.messagesToday,
        uptime: botData.uptime,
        recentActivity: botData.recentActivity,
        discordUser: newDiscordStatus.username,
        guilds: newDiscordStatus.guilds
      });
      
    } catch (error) {
      console.error('Error toggling bot connection:', error);
      socket.emit('botError', { error: 'Failed to toggle bot connection' });
    }
  }

  // Persona handlers
  async handleUpdatePersona(socket, personaData) {
    try {
      console.log('Persona updated via socket:', personaData);
      
      if (personaData.name && personaData.description) {
        const updates = {
          name: personaData.name.trim(),
          description: personaData.description.trim()
        };
        
        const success = await storage.updatePersona(updates);
        
        if (success) {
          const activity = await storage.addActivity(`Persona updated: ${personaData.name}`);
          
          socket.emit('personaUpdated', { success: true, data: storage.getPersona() });
          this.io.emit('newActivity', activity);
        } else {
          socket.emit('personaUpdated', { success: false, error: 'Failed to save persona' });
        }
      } else {
        socket.emit('personaUpdated', { success: false, error: 'Name and description required' });
      }
    } catch (error) {
      console.error('Error updating persona:', error);
      socket.emit('personaUpdated', { success: false, error: 'Server error' });
    }
  }

  // Settings handlers
  // Settings handlers
  async handleUpdateSettings(socket, settingsData) {
    try {
      console.log('Settings updated via socket:', settingsData);
      
      let updated = [];
      const updates = {};
      let needsBotRestart = false;
      
      // Handle bot token
      if (settingsData.botToken !== undefined) {
        updates.botToken = settingsData.botToken.trim();
        updated.push('bot token');
        needsBotRestart = true;
      }
      
      // Handle command prefix
      if (settingsData.commandPrefix !== undefined) {
        if (settingsData.commandPrefix.trim()) {
          updates.commandPrefix = settingsData.commandPrefix.trim();
          updated.push('command prefix');
        }
      }

      // Handle LLM settings
      if (settingsData.llm && typeof settingsData.llm === 'object') {
        const { validated, errors } = this.validateLLMSettings(settingsData.llm);
        
        if (errors.length > 0) {
          socket.emit('settingsUpdated', { 
            success: false, 
            error: `LLM validation errors: ${errors.join(', ')}` 
          });
          return;
        }
        
        updates.llm = validated;
        updated.push('LLM configuration');
      }
      
      if (updated.length > 0) {
        const success = await storage.updateSettings(updates);
        
        if (success) {
          const activity = await storage.addActivity(`Settings updated: ${updated.join(', ')}`);
          
          // Restart Discord bot if token was updated
          if (needsBotRestart) {
            try {
              await discordService.updateToken(updates.botToken);
              await storage.addActivity('Bot restarted with new token');
            } catch (error) {
              console.error('Failed to restart bot with new token:', error);
              await storage.addActivity('Bot restart failed with new token');
            }
          }
          
          socket.emit('settingsUpdated', { success: true });
          this.io.emit('newActivity', activity);
        } else {
          socket.emit('settingsUpdated', { success: false, error: 'Failed to save settings' });
        }
      } else {
        socket.emit('settingsUpdated', { success: false, error: 'No valid settings provided' });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      socket.emit('settingsUpdated', { success: false, error: 'Server error' });
    }
  }

  // LLM settings validation helper
  validateLLMSettings(settings) {
    const validated = {};
    const errors = [];
    
    // Temperature: 0-2
    if (settings.temperature !== undefined) {
      const temp = parseFloat(settings.temperature);
      if (!isNaN(temp) && temp >= 0 && temp <= 2) {
        validated.temperature = temp;
      } else {
        errors.push('Temperature must be between 0 and 2');
      }
    }
    
    // Top P: 0.01-1
    if (settings.top_p !== undefined) {
      const topP = parseFloat(settings.top_p);
      if (!isNaN(topP) && topP >= 0.01 && topP <= 1) {
        validated.top_p = topP;
      } else {
        errors.push('Top P must be between 0.01 and 1');
      }
    }
    
    // Top K: -1 or positive integer
    if (settings.top_k !== undefined) {
      const topK = parseInt(settings.top_k);
      if (!isNaN(topK) && (topK === -1 || topK > 0)) {
        validated.top_k = topK;
      } else {
        errors.push('Top K must be -1 or a positive integer');
      }
    }
    
    // Frequency Penalty: -2 to 2
    if (settings.frequency_penalty !== undefined) {
      const freqPen = parseFloat(settings.frequency_penalty);
      if (!isNaN(freqPen) && freqPen >= -2 && freqPen <= 2) {
        validated.frequency_penalty = freqPen;
      } else {
        errors.push('Frequency penalty must be between -2 and 2');
      }
    }
    
    // Presence Penalty: -2 to 2
    if (settings.presence_penalty !== undefined) {
      const presPen = parseFloat(settings.presence_penalty);
      if (!isNaN(presPen) && presPen >= -2 && presPen <= 2) {
        validated.presence_penalty = presPen;
      } else {
        errors.push('Presence penalty must be between -2 and 2');
      }
    }
    
    // Repetition Penalty: 0.1-2
    if (settings.repetition_penalty !== undefined) {
      const repPen = parseFloat(settings.repetition_penalty);
      if (!isNaN(repPen) && repPen >= 0.1 && repPen <= 2) {
        validated.repetition_penalty = repPen;
      } else {
        errors.push('Repetition penalty must be between 0.1 and 2');
      }
    }
    
    // Min P: 0-1
    if (settings.min_p !== undefined) {
      const minP = parseFloat(settings.min_p);
      if (!isNaN(minP) && minP >= 0 && minP <= 1) {
        validated.min_p = minP;
      } else {
        errors.push('Min P must be between 0 and 1');
      }
    }
    
    return { validated, errors };
  }

  // Discord server/channel handlers
  handleGetServers(socket) {
    try {
      const servers = discordService.getServers();
      socket.emit('serversData', { servers });
    } catch (error) {
      console.error('Error getting servers:', error);
      socket.emit('serversData', { servers: [], error: 'Failed to get servers' });
    }
  }

  handleGetChannels(socket, data) {
    try {
      const { serverId } = data;
      if (!serverId) {
        socket.emit('channelsData', { channels: [], error: 'Server ID required' });
        return;
      }

      const channels = discordService.getChannels(serverId);
      const activeChannels = discordService.getActiveChannels(serverId);
      
      socket.emit('channelsData', { 
        channels, 
        activeChannels,
        serverId 
      });
    } catch (error) {
      console.error('Error getting channels:', error);
      socket.emit('channelsData', { channels: [], error: 'Failed to get channels' });
    }
  }

  async handleUpdateActiveChannels(socket, data) {
    try {
      const { serverId, channelIds } = data;
      
      if (!serverId || !Array.isArray(channelIds)) {
        socket.emit('activeChannelsUpdated', { 
          success: false, 
          error: 'Invalid server ID or channel IDs' 
        });
        return;
      }

      const success = await discordService.updateActiveChannels(serverId, channelIds);
      
      socket.emit('activeChannelsUpdated', { 
        success,
        serverId,
        channelIds: success ? channelIds : []
      });

    } catch (error) {
      console.error('Error updating active channels:', error);
      socket.emit('activeChannelsUpdated', { 
        success: false, 
        error: 'Failed to update active channels' 
      });
    }
  }

  async handleGetBotStatus(socket) {
    try {
      const botData = await getBotData();
      const discordStatus = discordService.getStatus();
      
      socket.emit('botStatus', {
        isConnected: discordStatus.isConnected,
        activeUsers: botData.activeUsers,
        messagesToday: botData.messagesToday,
        uptime: botData.uptime,
        recentActivity: botData.recentActivity,
        discordUser: discordStatus.username,
        guilds: discordStatus.guilds
      });
    } catch (error) {
      console.error('Error getting bot status:', error);
    }
  }
}

module.exports = SocketHandlers;