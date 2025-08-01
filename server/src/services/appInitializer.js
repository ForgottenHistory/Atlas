const storage = require('../utils/storage');
const discordService = require('./discord');
const logger = require('./logger/Logger');

class AppInitializer {
  static async initialize() {
    try {
      logger.info('Starting Atlas Bot application initialization', { 
        source: 'system',
        nodeEnv: process.env.NODE_ENV || 'development'
      });

      // Initialize storage
      await storage.init();
      logger.success('Storage initialized successfully', { 
        source: 'system',
        filepath: storage.filepath 
      });
      
      // Initialize Discord bot
      const botStarted = await discordService.initialize();
      if (botStarted) {
        logger.success('Discord bot initialized successfully', { 
          source: 'discord',
          status: discordService.getStatus()
        });
      } else {
        logger.warn('Discord bot initialization skipped (no token)', { 
          source: 'discord'
        });
      }

      logger.success('Atlas Bot application initialized successfully', { 
        source: 'system',
        discordConnected: botStarted
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize application', {
        source: 'system',
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  static async shutdown() {
    try {
      logger.info('Starting graceful shutdown', { source: 'system' });
      
      await discordService.disconnect();
      logger.info('Discord service disconnected', { source: 'discord' });
      
      logger.success('Application shutdown complete', { source: 'system' });
    } catch (error) {
      logger.error('Error during shutdown', {
        source: 'system',
        error: error.message,
        stack: error.stack
      });
    }
  }
}

module.exports = AppInitializer;