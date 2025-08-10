const { getBotData, updateRuntimeData } = require('../routes/bot');
const storage = require('../utils/storage');
const discordService = require('../services/discord');
const logger = require('../services/logger/Logger');
const LLMServiceSingleton = require('../services/llm/LLMServiceSingleton');
const BotConnectionHandler = require('./handlers/BotConnectionHandler');
const PersonaHandler = require('./handlers/PersonaHandler');
const SettingsHandler = require('./handlers/SettingsHandler');
const DiscordServerHandler = require('./handlers/DiscordServerHandler');

class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.llmService = LLMServiceSingleton.getInstance();
    this.botConnectionHandler = new BotConnectionHandler(io, discordService, { getBotData, updateRuntimeData }, storage);
    this.personaHandler = new PersonaHandler(io, storage);
    this.settingsHandler = new SettingsHandler(io, storage, discordService);
    this.discordServerHandler = new DiscordServerHandler(io, discordService);
    
    // Setup logger listener for real-time log broadcasting
    this.setupLoggerListener();
    
    // Setup prompt listener for real-time prompt broadcasting
    this.setupPromptListener();
  }

  setupLoggerListener() {
    // Listen for new logs and broadcast to all connected clients
    logger.addListener((logEntry) => {
      if (logEntry.type !== 'clear') {
        this.io.emit('newLog', logEntry);
      } else {
        this.io.emit('logsCleared');
      }
    });
  }

  setupPromptListener() {
    // Listen for prompt generation events from the LLM service
    process.on('promptGenerated', (promptData) => {
      // Create a special log entry for prompts
      const promptLogEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `AI prompt generated for ${promptData.character}`,
        details: {
          source: 'llm',
          character: promptData.character,
          promptLength: promptData.prompt?.length || 0,
          tokenUsage: promptData.tokenUsage,
          channel: promptData.channel,
          author: promptData.author,
          fullPrompt: promptData.prompt
        },
        source: 'llm'
      };

      // Broadcast as a special log entry
      this.io.emit('newLog', promptLogEntry);
    });
  }

  // Prompt data handlers
  handleGetLastPrompt(socket) {
    try {
      const promptData = global.lastPromptData || null;
      
      logger.debug('Last prompt requested via socket', {
        source: 'api',
        socketId: socket.id,
        hasPromptData: !!promptData
      });
      
      socket.emit('promptData', { prompt: promptData });
    } catch (error) {
      logger.error('Failed to get last prompt via socket', {
        source: 'api',
        socketId: socket.id,
        error: error.message
      });
      
      socket.emit('promptData', { prompt: null, error: 'Failed to retrieve prompt data' });
    }
  }

  // Bot connection handlers
  async handleToggleBotConnection(socket) {
    return await this.botConnectionHandler.handleToggleBotConnection(socket);
  }

  async handleGetBotStatus(socket) {
    return await this.botConnectionHandler.handleGetBotStatus(socket);
  }

  // Persona handlers
  async handleUpdatePersona(socket, personaData) {
    return await this.personaHandler.handleUpdatePersona(socket, personaData);
  }

  // Settings handlers
  async handleUpdateSettings(socket, settingsData) {
    return await this.settingsHandler.handleUpdateSettings(socket, settingsData);
  }

  // Discord server/channel handlers
  handleGetServers(socket) {
    return this.discordServerHandler.handleGetServers(socket);
  }

  handleGetChannels(socket, data) {
    return this.discordServerHandler.handleGetChannels(socket, data);
  }

  async handleUpdateActiveChannels(socket, data) {
    return await this.discordServerHandler.handleUpdateActiveChannels(socket, data);
  }

  // Log handlers
  handleGetLogs(socket, data = {}) {
    try {
      const { limit = 50, level, source, search } = data;
      
      const logs = logger.filterLogs({
        limit,
        level,
        source,
        search
      });

      socket.emit('logsData', { logs });
    } catch (error) {
      logger.error('Failed to get logs via socket', { 
        source: 'api',
        socketId: socket.id,
        error: error.message
      });
      
      socket.emit('logsData', { logs: [], error: 'Failed to retrieve logs' });
    }
  }

  handleClearLogs(socket) {
    try {
      logger.clearLogs();
      
      // Notify all clients that logs were cleared
      this.io.emit('logsCleared');
      
      logger.info('Logs cleared via socket', { 
        source: 'api',
        socketId: socket.id
      });
    } catch (error) {
      logger.error('Failed to clear logs via socket', { 
        source: 'api',
        socketId: socket.id,
        error: error.message
      });
    }
  }

  // Queue handlers
  handleGetQueueStats(socket) {
    try {
      const stats = this.llmService.getQueueStats();
      const health = this.llmService.getQueueHealth();
      
      logger.debug('Manual queue stats requested', {
        source: 'system',
        socketId: socket.id,
        stats: stats,
        health: health
      });
      
      socket.emit('queueStats', {
        stats,
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get queue stats via socket', {
        source: 'system',
        socketId: socket.id,
        error: error.message
      });
      
      socket.emit('queueStats', { 
        error: 'Failed to retrieve queue stats',
        timestamp: new Date().toISOString()
      });
    }
  }

  handleUpdateQueueConfig(socket, data) {
    try {
      const { globalLimit, typeLimit, requestType } = data;
      
      if (globalLimit !== undefined) {
        this.llmService.setGlobalConcurrencyLimit(globalLimit);
        logger.info('Global queue limit updated via socket', {
          source: 'system',
          socketId: socket.id,
          newLimit: globalLimit
        });
      }
      
      if (typeLimit !== undefined && requestType) {
        this.llmService.setQueueConcurrencyLimit(requestType, typeLimit);
        logger.info('Request type queue limit updated via socket', {
          source: 'system',
          socketId: socket.id,
          requestType,
          newLimit: typeLimit
        });
      }
      
      // Stats will be automatically broadcasted by the queue listener
      socket.emit('queueConfigUpdated', { 
        success: true,
        message: 'Queue configuration updated'
      });
      
    } catch (error) {
      logger.error('Failed to update queue config via socket', {
        source: 'system',
        socketId: socket.id,
        error: error.message
      });
      
      socket.emit('queueConfigUpdated', { 
        success: false, 
        error: 'Failed to update queue configuration' 
      });
    }
  }
}

module.exports = SocketHandlers;