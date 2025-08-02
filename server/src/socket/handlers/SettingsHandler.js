const { validateLLMSettings } = require('../../routes/settings/validators/llmValidator');

class SettingsHandler {
  constructor(io, storage, discordService) {
    this.io = io;
    this.storage = storage;
    this.discordService = discordService;
  }

  async handleUpdateSettings(socket, settingsData) {
    try {
      console.log('Settings updated via socket:', settingsData);
      
      const { updates, llmUpdates, updated, needsBotRestart, error } = this._processSettingsData(settingsData);
      
      if (error) {
        socket.emit('settingsUpdated', { success: false, error });
        return;
      }

      if (updated.length === 0) {
        socket.emit('settingsUpdated', { success: false, error: 'No valid settings provided' });
        return;
      }

      let success = true;
      
      // Save general settings if any
      if (Object.keys(updates).length > 0) {
        success = await this.storage.updateSettings(updates);
        console.log('General settings update result:', success);
      }
      
      // Save LLM settings separately if any
      if (Object.keys(llmUpdates).length > 0) {
        const llmSuccess = await this.storage.updateLLMSettings(llmUpdates);
        console.log('LLM settings update result:', llmSuccess, 'Data:', llmUpdates);
        success = success && llmSuccess;
      }
      
      if (success) {
        const activity = await this.storage.addActivity(`Settings updated: ${updated.join(', ')}`);
        
        if (needsBotRestart) {
          await this._handleBotRestart(updates.botToken);
        }
        
        socket.emit('settingsUpdated', { success: true });
        this.io.emit('newActivity', activity);
        
        console.log('Settings successfully saved');
      } else {
        console.error('Failed to save settings to storage');
        socket.emit('settingsUpdated', { success: false, error: 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      socket.emit('settingsUpdated', { success: false, error: 'Server error' });
    }
  }

  _processSettingsData(settingsData) {
    let updated = [];
    const updates = {};
    const llmUpdates = {};
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

    // Handle LLM settings - this is the key fix!
    if (settingsData.llm && typeof settingsData.llm === 'object') {
      console.log('Processing LLM settings:', settingsData.llm);
      
      const llmValidation = validateLLMSettings(settingsData.llm);
      
      if (llmValidation.error) {
        return { 
          error: `LLM validation errors: ${llmValidation.error}` 
        };
      }
      
      // Store LLM settings separately
      Object.assign(llmUpdates, llmValidation.settings);
      updated.push('LLM configuration');
      
      console.log('Validated LLM settings:', llmValidation.settings);
    }

    return { updates, llmUpdates, updated, needsBotRestart };
  }

  async _handleBotRestart(newToken) {
    try {
      await this.discordService.updateToken(newToken);
      await this.storage.addActivity('Bot restarted with new token');
    } catch (error) {
      console.error('Failed to restart bot with new token:', error);
      await this.storage.addActivity('Bot restart failed with new token');
    }
  }
}

module.exports = SettingsHandler;