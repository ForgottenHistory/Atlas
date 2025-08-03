const ActionRouter = require('./actions/ActionRouter');
const ActionLogger = require('./actions/ActionLogger');
const ActionValidator = require('./actions/ActionValidator');
const logger = require('../logger/Logger');

class ActionExecutor {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    
    // Initialize focused services
    this.router = new ActionRouter(discordClient, conversationManager);
    this.actionLogger = new ActionLogger();
    this.validator = new ActionValidator(discordClient);
    
    logger.info('ActionExecutor initialized', {
      source: 'discord',
      supportedActions: ['respond', 'reply', 'react', 'ignore', 'status_change', 'typing']
    });
  }

  async executeAction(decision, message) {
    try {
      // Log the action decision
      this.actionLogger.logActionDecision(decision, message);

      // Validate the action can be performed
      const validation = this.validator.validateAction(decision, message);
      if (!validation.canExecute) {
        logger.warn('Action execution blocked', {
          source: 'discord',
          action: decision.action,
          reason: validation.reason,
          channel: message.channel.name
        });
        return { success: false, error: validation.reason };
      }

      // Route to appropriate action handler
      const result = await this.router.routeAction(decision, message);

      // Log the result
      this.actionLogger.logActionResult(decision, message, result);

      return result;

    } catch (error) {
      logger.error('Action execution failed', {
        source: 'discord',
        action: decision.action,
        error: error.message,
        channel: message.channel.name
      });
      return { success: false, error: error.message };
    }
  }

  // Utility method to check if bot can perform actions in channel
  canActInChannel(channel) {
    return this.validator.canActInChannel(channel);
  }

  // Get execution statistics
  getExecutionStats() {
    return this.actionLogger.getStats();
  }

  // Get supported actions
  getSupportedActions() {
    return this.router.getSupportedActions();
  }
}

module.exports = ActionExecutor;