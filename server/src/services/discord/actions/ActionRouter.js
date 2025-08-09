const ResponseAction = require('./ResponseAction');
const ReactionAction = require('./ReactionAction');
const StatusAction = require('./StatusAction');
const IgnoreAction = require('./IgnoreAction');
const logger = require('../../logger/Logger');

class ActionRouter {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    
    // Initialize action handlers
    this.actions = new Map();
    this.initializeActions();
  }

  initializeActions() {
    const responseAction = new ResponseAction(this.discordClient, this.conversationManager);
    const reactionAction = new ReactionAction(this.discordClient);
    const statusAction = new StatusAction(this.discordClient);
    const ignoreAction = new IgnoreAction();

    // Register actions
    this.actions.set('respond', responseAction);
    this.actions.set('reply', responseAction);
    this.actions.set('react', reactionAction);
    this.actions.set('status_change', statusAction);
    this.actions.set('ignore', ignoreAction);

    logger.debug('Action handlers initialized', {
      source: 'discord',
      actions: Array.from(this.actions.keys())
    });
  }

  async routeAction(decision, message) {
    // Safety check: Tool actions should not reach ActionRouter
    if (this.isToolAction(decision.action)) {
      logger.warn('Tool action reached ActionRouter - this should be handled by ToolExecutor', {
        source: 'discord',
        action: decision.action,
        messageId: message.id,
        suggestion: 'Check decision chain logic'
      });
      
      // Convert to ignore action as safety fallback
      return await this.actions.get('ignore').executeIgnore(message, 
        `Tool action '${decision.action}' improperly reached ActionRouter`);
    }

    const actionHandler = this.actions.get(decision.action);
    
    if (!actionHandler) {
      logger.warn('Unknown action type', {
        source: 'discord',
        action: decision.action,
        availableActions: Array.from(this.actions.keys())
      });
      return { success: false, error: 'Unknown action' };
    }

    // Route to the appropriate handler
    switch (decision.action) {
      case 'respond':
        return await actionHandler.executeRespond(message);
        
      case 'reply':
        return await actionHandler.executeReply(message);
        
      case 'react':
        return await actionHandler.executeReact(message, decision.emoji);
        
      case 'ignore':
        return await actionHandler.executeIgnore(message, decision.reasoning);
        
      case 'status_change':
        return await actionHandler.executeStatusChange(decision.status);
        
      default:
        return { success: false, error: 'Unhandled action type' };
    }
  }

  isToolAction(action) {
    const toolActions = ['profile_lookup'];
    return toolActions.includes(action);
  }

  getSupportedActions() {
    return Array.from(this.actions.keys());
  }

  getActionHandler(actionType) {
    return this.actions.get(actionType);
  }

  hasAction(actionType) {
    return this.actions.has(actionType);
  }

  // Register custom action handler
  registerAction(actionType, handler) {
    this.actions.set(actionType, handler);
    
    logger.info('Custom action registered', {
      source: 'discord',
      actionType: actionType
    });
  }

  // Remove action handler
  unregisterAction(actionType) {
    const removed = this.actions.delete(actionType);
    
    if (removed) {
      logger.info('Action unregistered', {
        source: 'discord',
        actionType: actionType
      });
    }
    
    return removed;
  }
}

module.exports = ActionRouter;