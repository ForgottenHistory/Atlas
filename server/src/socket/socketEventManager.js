const { getBotData, getRuntimeData, updateRuntimeData } = require('../routes/bot');
const discordService = require('../services/discord');
const logger = require('../services/logger/Logger');
const LLMServiceSingleton = require('../services/llm/LLMServiceSingleton');

class SocketEventManager {
  constructor(io) {
    this.io = io;
    this.llmService = LLMServiceSingleton.getInstance();
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
      await this.handleMessageReceived(data);
    });
  }

  async handleMessageReceived(data) {
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
  }

  async sendInitialData(socket) {
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
  }
}

module.exports = SocketEventManager;