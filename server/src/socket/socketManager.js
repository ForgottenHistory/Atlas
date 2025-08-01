const socketIo = require('socket.io');
const SocketHandlers = require('./socketHandlers');
const { getBotData, getRuntimeData, updateRuntimeData } = require('../routes/bot');
const discordService = require('../services/discord');

class SocketManager {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });
    
    this.handlers = new SocketHandlers(this.io);
    this.setupDiscordEventHandlers();
    this.setupSocketHandlers();
    this.startStatsUpdates();
  }

  setupDiscordEventHandlers() {
    // Discord bot event handlers for socket.io
    discordService.on('botConnected', (data) => {
      console.log('Discord bot connected, notifying clients');
      updateRuntimeData({ isConnected: true });
      this.io.emit('botStatus', { 
        ...getRuntimeData(), 
        discordUser: data.username,
        guilds: data.guilds 
      });
    });

    discordService.on('botDisconnected', () => {
      console.log('Discord bot disconnected, notifying clients');
      updateRuntimeData({ isConnected: false });
      this.io.emit('botStatus', getRuntimeData());
    });

    discordService.on('botError', (data) => {
      console.log('Discord bot error:', data.error);
      this.io.emit('botError', data);
    });

    discordService.on('messageReceived', async (data) => {
      // Update message stats
      const runtimeData = getRuntimeData();
      updateRuntimeData({ 
        messagesToday: runtimeData.messagesToday + 1 
      });
      
      // Notify clients
      this.io.emit('statsUpdate', {
        messagesToday: runtimeData.messagesToday + 1,
        activeUsers: runtimeData.activeUsers
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
      console.log('Client connected:', socket.id);
      
      try {
        // Get current data and send initial status
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
        console.error('Error initializing socket connection:', error);
      }

      // Register event handlers
      socket.on('toggleBotConnection', () => this.handlers.handleToggleBotConnection(socket));
      socket.on('updatePersona', (data) => this.handlers.handleUpdatePersona(socket, data));
      socket.on('updateSettings', (data) => this.handlers.handleUpdateSettings(socket, data));
      socket.on('getServers', () => this.handlers.handleGetServers(socket));
      socket.on('getChannels', (data) => this.handlers.handleGetChannels(socket, data));
      socket.on('updateActiveChannels', (data) => this.handlers.handleUpdateActiveChannels(socket, data));
      socket.on('getBotStatus', () => this.handlers.handleGetBotStatus(socket));

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
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
          messagesToday: runtimeData.messagesToday
        });
      }
    }, 5000);
  }

  getIO() {
    return this.io;
  }
}

module.exports = SocketManager;