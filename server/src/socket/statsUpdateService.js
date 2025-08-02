const { getRuntimeData, updateRuntimeData } = require('../routes/bot');
const discordService = require('../services/discord');
const LLMServiceSingleton = require('../services/llm/LLMServiceSingleton');

class StatsUpdateService {
  constructor(io) {
    this.io = io;
    this.llmService = LLMServiceSingleton.getInstance();
    this.updateInterval = null;
  }

  startUpdates() {
    // Simulate real-time stats updates (only when bot is connected)
    this.updateInterval = setInterval(() => {
      this.updateBotStats();
    }, 5000); // Every 5 seconds
  }

  updateBotStats() {
    const discordStatus = discordService.getStatus();
    
    if (!discordStatus.isConnected) {
      return; // Skip if bot is not connected
    }

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

  stopUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

module.exports = StatsUpdateService;