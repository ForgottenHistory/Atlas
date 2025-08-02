const socketIo = require('socket.io');
const SocketHandlers = require('./socketHandlers');
const { getBotData, getRuntimeData, updateRuntimeData } = require('../routes/bot');
const discordService = require('../services/discord');
const logger = require('../services/logger/Logger');
const LLMServiceSingleton = require('../services/llm/LLMServiceSingleton');

class SocketManager {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });
    
    this.handlers = new SocketHandlers(this.io);
    this.llmService = LLMServiceSingleton.getInstance(); // Use singleton
    this.setupDiscordEventHandlers();
    this.setupSocketHandlers();
    this.startStatsUpdates();
    this.setupQueueMonitoring();
    
    // Log socket manager initialization
    logger.info('Socket.IO manager initialized with singleton LLM service', { 
      source: 'system',
      cors: 'http://localhost:5173',
      queueMonitoring: true,
      singleton: true
    });
  }

  setupQueueMonitoring() {
    // Listen to real-time queue stats from the singleton LLM service
    this.llmService.requestQueue.addStatsListener(({ stats, health }) => {
      logger.debug('Queue stats listener triggered', {
        source: 'system',
        totalQueued: health.totalQueued,
        activeGlobal: health.activeGlobal,
        hasActivity: Object.values(stats.types).some(type => type.queued > 0 || type.active > 0)
      });
      
      // Broadcast queue updates to all connected clients
      this.io.emit('queueUpdate', {
        stats,
        health,
        timestamp: new Date().toISOString()
      });
      
      // Also log significant queue events
      const hasActivity = Object.values(stats.types).some(type => 
        type.queued > 0 || type.active > 0
      );
      
      if (hasActivity) {
        logger.info('Broadcasting queue activity to clients', {
          source: 'system',
          totalQueued: health.totalQueued,
          activeGlobal: health.activeGlobal,
          connectedClients: this.io.engine.clientsCount,
          types: Object.entries(stats.types)
            .filter(([_, type]) => type.queued > 0 || type.active > 0)
            .map(([name, type]) => `${name}: ${type.active}/${type.limit} active, ${type.queued} queued`)
            .join(', ')
        });
      }
    });
    
    // Also periodically broadcast current queue stats (as backup)
    setInterval(() => {
      const stats = this.llmService.getQueueStats();
      const health = this.llmService.getQueueHealth();
      
      const hasActivity = Object.values(stats.types).some(type => 
        type.queued > 0 || type.active > 0
      );
      
      if (hasActivity) {
        this.io.emit('queueUpdate', {
          stats,
          health,
          timestamp: new Date().toISOString()
        });
        
        logger.debug('Periodic queue update sent', {
          source: 'system',
          totalQueued: health.totalQueued,
          activeGlobal: health.activeGlobal
        });
      }
    }, 1000); // Every second
  }

  setupDiscordEventHandlers() {
    // Discord bot event handlers for socket.io
    discordService.on('botConnected', (data) => {
      logger.success('Discord bot connected', { 
        source: 'discord',
        username: data.username,
        guilds: data.guilds
      });
      
      updateRuntimeData({ isConnected: true });
      this.io.emit('botStatus', { 
        ...getRuntimeData(), 
        discordUser: data.username,
        guilds: data.guilds,
        queueStats: this.llmService.getQueueStats(),
        queueHealth: this.llmService.getQueueHealth()
      });
    });

    discordService.on('botDisconnected', () => {
      logger.warn('Discord bot disconnected', { source: 'discord' });
      
      updateRuntimeData({ isConnected: false });
      this.io.emit('botStatus', {
        ...getRuntimeData(),
        queueStats: this.llmService.getQueueStats(),
        queueHealth: this.llmService.getQueueHealth()
      });
    });

    discordService.on('botError', (data) => {
      logger.error('Discord bot error', { 
        source: 'discord',
        error: data.error
      });
      
      this.io.emit('botError', data);
    });

    discordService.on('messageReceived', async (data) => {
      // Update message stats
      const runtimeData = getRuntimeData();
      updateRuntimeData({ 
        messagesToday: runtimeData.messagesToday + 1 
      });
      
      logger.info('Message received and processed', {
        source: 'discord',
        author: data.author,
        guild: data.guild,
        channel: data.channel
      });
      
      // Notify clients with queue stats
      this.io.emit('statsUpdate', {
        messagesToday: runtimeData.messagesToday + 1,
        activeUsers: runtimeData.activeUsers,
        queueStats: this.llmService.getQueueStats()
      });
      
      // Add activity log
      const storage = require('../utils/storage');
      await storage.addActivity(`Message from ${data.author} in ${data.guild}`);
      const activity = storage.getRecentActivity();
      this.io.emit('newActivity', activity[0]);
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', async (socket) => {
      logger.info('Client connected', { 
        source: 'system',
        socketId: socket.id,
        clientIP: socket.handshake.address,
        totalClients: this.io.engine.clientsCount
      });
      
      try {
        // Get current data and send initial status with queue info
        const botData = await getBotData();
        const discordStatus = discordService.getStatus();
        
        socket.emit('botStatus', {
          isConnected: discordStatus.isConnected,
          activeUsers: botData.activeUsers,
          messagesToday: botData.messagesToday,
          uptime: botData.uptime,
          recentActivity: botData.recentActivity,
          discordUser: discordStatus.username,
          guilds: discordStatus.guilds,
          queueStats: botData.queueStats,
          queueHealth: botData.queueHealth
        });
        
        // Also send immediate queue stats
        const stats = this.llmService.getQueueStats();
        const health = this.llmService.getQueueHealth();
        
        socket.emit('queueStats', {
          stats,
          health,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error('Error initializing socket connection', {
          source: 'system',
          socketId: socket.id,
          error: error.message
        });
      }

      // Register event handlers
      socket.on('toggleBotConnection', () => this.handlers.handleToggleBotConnection(socket));
      socket.on('updatePersona', (data) => this.handlers.handleUpdatePersona(socket, data));
      socket.on('updateSettings', (data) => this.handlers.handleUpdateSettings(socket, data));
      socket.on('getServers', () => this.handlers.handleGetServers(socket));
      socket.on('getChannels', (data) => this.handlers.handleGetChannels(socket, data));
      socket.on('updateActiveChannels', (data) => this.handlers.handleUpdateActiveChannels(socket, data));
      socket.on('getBotStatus', () => this.handlers.handleGetBotStatus(socket));
      
      // Log-specific event handlers
      socket.on('getLogs', (data) => this.handlers.handleGetLogs(socket, data));
      socket.on('clearLogs', () => this.handlers.handleClearLogs(socket));

      // Queue monitoring handlers
      socket.on('getQueueStats', () => this.handleGetQueueStats(socket));
      socket.on('updateQueueConfig', (data) => this.handleUpdateQueueConfig(socket, data));

      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', { 
          source: 'system',
          socketId: socket.id,
          reason: reason,
          remainingClients: this.io.engine.clientsCount - 1
        });
      });
    });
  }

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

  startStatsUpdates() {
    // Simulate real-time stats updates (only when bot is connected)
    setInterval(() => {
      const discordStatus = discordService.getStatus();
      if (discordStatus.isConnected) {
        const runtimeData = getRuntimeData();
        const updates = {
          activeUsers: Math.max(0, runtimeData.activeUsers + Math.floor(Math.random() * 3) - 1)
        };
        
        updateRuntimeData(updates);
        
        this.io.emit('statsUpdate', {
          activeUsers: updates.activeUsers,
          messagesToday: runtimeData.messagesToday,
          queueStats: this.llmService.getQueueStats()
        });
      }
    }, 5000);
  }

  getIO() {
    return this.io;
  }
}

module.exports = SocketManager;