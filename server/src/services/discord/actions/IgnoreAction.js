const logger = require('../../logger/Logger');

class IgnoreAction {
  constructor() {
    // Simple action, no dependencies needed
  }

  async executeIgnore(message, reasoning) {
    logger.debug('Ignore action executed', {
      source: 'discord',
      reasoning: reasoning,
      channel: message.channel.name,
      author: message.author.username
    });
    
    return { success: true, actionType: 'ignore', reasoning };
  }

  // Get ignore statistics (could be expanded)
  getIgnoreStats() {
    return {
      actionType: 'ignore',
      description: 'No action taken - message ignored based on decision engine',
      cost: 'none',
      impact: 'none'
    };
  }
}

module.exports = IgnoreAction;