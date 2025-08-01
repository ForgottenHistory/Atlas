const storage = require('../utils/storage');
const discordService = require('./discord');

class AppInitializer {
  static async initialize() {
    try {
      // Initialize storage
      await storage.init();
      console.log('Storage initialized successfully');
      
      // Initialize Discord bot
      const botStarted = await discordService.initialize();
      if (botStarted) {
        console.log('Discord bot initialized successfully');
      } else {
        console.log('Discord bot initialization skipped (no token)');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      return false;
    }
  }

  static async shutdown() {
    try {
      console.log('Shutting down gracefully...');
      await discordService.disconnect();
      console.log('Application shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

module.exports = AppInitializer;