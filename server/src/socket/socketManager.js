const socketIo = require('socket.io');
const SocketHandlers = require('./socketHandlers');
const SocketEventManager = require('./socketEventManager');
const QueueMonitoringService = require('./queueMonitoringService');
const StatsUpdateService = require('./statsUpdateService');
const logger = require('../services/logger/Logger');

class SocketManager {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });

    this.handlers = new SocketHandlers(this.io);
    this.eventManager = new SocketEventManager(this.io);
    this.queueMonitoring = new QueueMonitoringService(this.io);
    this.statsUpdater = new StatsUpdateService(this.io);

    this.initialize();

    logger.info('Socket.IO manager initialized with modular services', {
      source: 'system',
      cors: 'http://localhost:5173',
      services: ['EventManager', 'QueueMonitoring', 'StatsUpdater', 'Handlers']
    });
  }

  initialize() {
    this.eventManager.setupDiscordEventHandlers();
    this.queueMonitoring.startMonitoring();
    this.statsUpdater.startUpdates();
    this.setupSocketHandlers();
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
        // Send initial data
        await this.eventManager.sendInitialData(socket);

        // Register all event handlers
        this.registerSocketEvents(socket);

      } catch (error) {
        logger.error('Error initializing socket connection', {
          source: 'system',
          socketId: socket.id,
          error: error.message
        });
      }

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

  registerSocketEvents(socket) {
    // Bot connection events
    socket.on('toggleBotConnection', () => this.handlers.handleToggleBotConnection(socket));
    socket.on('getBotStatus', () => this.handlers.handleGetBotStatus(socket));

    // Configuration events
    socket.on('updatePersona', (data) => this.handlers.handleUpdatePersona(socket, data));
    socket.on('updateSettings', (data) => this.handlers.handleUpdateSettings(socket, data));

    // Discord server/channel events
    socket.on('getServers', () => this.handlers.handleGetServers(socket));
    socket.on('getChannels', (data) => this.handlers.handleGetChannels(socket, data));
    socket.on('updateActiveChannels', (data) => this.handlers.handleUpdateActiveChannels(socket, data));

    // Log events
    socket.on('getLogs', (data) => this.handlers.handleGetLogs(socket, data));
    socket.on('clearLogs', () => this.handlers.handleClearLogs(socket));

    // Queue events
    socket.on('getQueueStats', () => this.handlers.handleGetQueueStats(socket));
    socket.on('updateQueueConfig', (data) => this.handlers.handleUpdateQueueConfig(socket, data));
  }

  getIO() {
    return this.io;
  }
}

module.exports = SocketManager;