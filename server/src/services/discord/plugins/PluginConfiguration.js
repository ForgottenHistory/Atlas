/**
 * Centralized plugin configuration
 * Adding new tools/actions only requires changes to this file
 */

// Import plugin classes
const ProfileLookupTool = require('./tools/ProfileLookupTool');
const ResponseAction = require('./actions/ResponseAction');

// Create ReactionAction plugin inline since we just created it
const Action = require('./interfaces/Action');
const logger = require('../../logger/Logger');

class ReactionActionPlugin extends Action {
  constructor(config = {}, dependencies = {}) {
    super(config, dependencies);
    this.discordClient = dependencies.discordClient;
    this.defaultEmoji = config.defaultEmoji || '👍';
  }

  async execute(context) {
    const { message, decision, originalMessage } = context;
    
    try {
      const discordMessage = originalMessage || message._originalMessage;
      if (!discordMessage) {
        return this.error(new Error('No Discord message available for reaction'));
      }

      const emoji = decision?.emoji || this.defaultEmoji;
      await discordMessage.react(emoji);

      logger.success('Reaction added successfully', {
        source: 'plugin',
        plugin: this.name,
        emoji: emoji,
        messageId: discordMessage.id
      });

      return this.success({
        action: 'react',
        emoji: emoji,
        reactedTo: discordMessage.id
      });

    } catch (error) {
      return this.error(error);
    }
  }

  getMetadata() {
    return {
      name: 'ReactionActionPlugin',
      type: 'action',
      description: 'Adds emoji reactions to messages',
      discordPermissions: ['AddReactions']
    };
  }
}

// Simple inline ignore action
const IgnoreActionHandler = require('./interfaces/Action');

class SimpleIgnoreAction extends IgnoreActionHandler {
  async execute(context) {
    return this.success({ action: 'ignore', ignored: true });
  }
  
  getMetadata() {
    return {
      name: 'SimpleIgnoreAction',
      type: 'action', 
      description: 'Ignores the message - no response needed',
      discordPermissions: [],
      estimatedExecutionTime: '0s'
    };
  }
}

/**
 * Plugin definitions - this is where new plugins are registered
 */
const PLUGIN_DEFINITIONS = {
  
  // === TOOL PLUGINS ===
  
  profile_lookup: {
    type: 'tool',
    handler: ProfileLookupTool,
    triggers: [
      'user_mentioned',
      'profile_keywords', 
      'user_lookup_request'
    ],
    dependencies: [
      'discordClient',
      'conversationManager'
    ],
    config: {
      maxLookupDepth: 100,
      enableActivityTracking: true,
      cacheResults: false
    },
    metadata: {
      description: 'Looks up Discord user profiles and activity',
      category: 'user_analysis',
      priority: 'normal'
    }
  },

  // === ACTION PLUGINS ===
  
  respond: {
    type: 'action',
    handler: ResponseAction,
    triggers: [
      'respond'
    ],
    dependencies: [
      'discordClient',
      'responseGenerator',
      'conversationManager'
    ],
    config: {
      enableTypingIndicator: true,
      maxResponseLength: 2000,
      forceReply: false,
      rateLimitSafe: true
    },
    metadata: {
      description: 'Sends normal message responses',
      category: 'communication',
      priority: 'high'
    }
  },

  reply: {
    type: 'action',
    handler: ResponseAction,
    triggers: [
      'reply'
    ],
    dependencies: [
      'discordClient',
      'responseGenerator',
      'conversationManager'
    ],
    config: {
      enableTypingIndicator: true,
      maxResponseLength: 2000,
      forceReply: true,
      rateLimitSafe: true
    },
    metadata: {
      description: 'Sends Discord reply responses',
      category: 'communication',
      priority: 'high'
    }
  },

  ignore: {
    type: 'action',
    handler: SimpleIgnoreAction,
    triggers: [
      'ignore'
    ],
    dependencies: [],
    config: {},
    metadata: {
      description: 'Ignores the message without responding',
      category: 'communication',
      priority: 'low'
    }
  },

  react: {
    type: 'action', 
    handler: ReactionActionPlugin,
    triggers: [
      'react'
    ],
    dependencies: [
      'discordClient'
    ],
    config: {
      defaultEmoji: '👍',
      enableCustomEmojis: true,
      rateLimitSafe: true
    },
    metadata: {
      description: 'Adds emoji reactions to messages',
      category: 'communication', 
      priority: 'medium'
    }
  }

};

/**
 * Plugin configuration management
 */
class PluginConfiguration {
  static getPluginDefinitions() {
    return PLUGIN_DEFINITIONS;
  }

  static getPluginDefinition(pluginName) {
    return PLUGIN_DEFINITIONS[pluginName] || null;
  }

  static getAllPlugins() {
    return Object.keys(PLUGIN_DEFINITIONS);
  }

  static getPluginsByType(type) {
    return Object.entries(PLUGIN_DEFINITIONS)
      .filter(([name, config]) => config.type === type)
      .reduce((result, [name, config]) => {
        result[name] = config;
        return result;
      }, {});
  }

  static getToolPlugins() {
    return this.getPluginsByType('tool');
  }

  static getActionPlugins() {
    return this.getPluginsByType('action');
  }

  /**
   * Validate a plugin definition (MISSING METHOD - REQUIRED BY PLUGIN LOADER)
   */
  static validatePluginDefinition(pluginName, pluginDefinition) {
    const errors = [];

    // Check plugin name
    if (!pluginName || typeof pluginName !== 'string') {
      errors.push('Plugin name must be a non-empty string');
    }

    // Check plugin definition exists
    if (!pluginDefinition) {
      errors.push('Plugin definition is required');
      return { valid: false, errors };
    }

    // Check required fields
    if (!pluginDefinition.type) {
      errors.push('Plugin type is required');
    } else if (!['tool', 'action', 'behavior'].includes(pluginDefinition.type)) {
      errors.push('Plugin type must be "tool", "action", or "behavior"');
    }

    if (!pluginDefinition.handler) {
      errors.push('Plugin handler is required');
    } else if (typeof pluginDefinition.handler !== 'function') {
      errors.push('Plugin handler must be a constructor function');
    }

    // Check optional fields format
    if (pluginDefinition.triggers && !Array.isArray(pluginDefinition.triggers)) {
      errors.push('Plugin triggers must be an array');
    }

    if (pluginDefinition.dependencies && !Array.isArray(pluginDefinition.dependencies)) {
      errors.push('Plugin dependencies must be an array');
    }

    if (pluginDefinition.config && typeof pluginDefinition.config !== 'object') {
      errors.push('Plugin config must be an object');
    }

    if (pluginDefinition.metadata && typeof pluginDefinition.metadata !== 'object') {
      errors.push('Plugin metadata must be an object');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = PluginConfiguration;