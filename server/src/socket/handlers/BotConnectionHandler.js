class BotConnectionHandler {
  constructor(io, discordService, botData, storage) {
    this.io = io;
    this.discordService = discordService;
    this.getBotData = botData.getBotData;
    this.updateRuntimeData = botData.updateRuntimeData;
    this.storage = storage;
  }

  async handleToggleBotConnection(socket) {
    try {
      const discordStatus = this.discordService.getStatus();
      
      if (discordStatus.isConnected) {
        await this._disconnectBot();
      } else {
        const success = await this._connectBot(socket);
        if (!success) return;
      }
      
      await this._broadcastBotStatus();
      
    } catch (error) {
      console.error('Error toggling bot connection:', error);
      socket.emit('botError', { error: 'Failed to toggle bot connection' });
    }
  }

  async handleGetBotStatus(socket) {
    try {
      const botData = await this.getBotData();
      const discordStatus = this.discordService.getStatus();
      
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

  async _disconnectBot() {
    await this.discordService.disconnect();
    this.updateRuntimeData({ isConnected: false });
    await this.storage.addActivity('Bot manually disconnected');
  }

  async _connectBot(socket) {
    const settings = this.storage.getSettings();
    if (!settings.botToken) {
      socket.emit('botError', { error: 'No bot token configured' });
      return false;
    }
    
    const success = await this.discordService.initialize();
    if (success) {
      this.updateRuntimeData({ isConnected: true });
      await this.storage.addActivity('Bot manually connected');
      return true;
    } else {
      socket.emit('botError', { error: 'Failed to connect bot' });
      return false;
    }
  }

  async _broadcastBotStatus() {
    const botData = await this.getBotData();
    const discordStatus = this.discordService.getStatus();
    
    this.io.emit('botStatus', {
      isConnected: discordStatus.isConnected,
      activeUsers: botData.activeUsers,
      messagesToday: botData.messagesToday,
      uptime: botData.uptime,
      recentActivity: botData.recentActivity,
      discordUser: discordStatus.username,
      guilds: discordStatus.guilds
    });
  }
}

module.exports = BotConnectionHandler;