/**
 * Centralized plugin configuration
 * Adding new tools/actions only requires changes to this file
 */

// Import plugin classes
const ProfileLookupTool = require('./tools/ProfileLookupTool');
const ResponseAction = require('./actions/ResponseAction');

/**
 * Plugin definitions - this is where new plugins are registered
 * NO CORE FILE CHANGES needed to add new plugins!
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
      'responseGenerator'
    ],
    config: {
      enableTypingIndicator: true,
      maxResponseLength: 2000,
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
    handler: ResponseAction, // Same handler, different config
    triggers: [
      'reply'
    ],
    dependencies: [
      'discordClient',
      'responseGenerator'
    ],
    config: {
      enableTypingIndicator: true,
      maxResponseLength: 2000,
      forceReply: true, // Config flag to force Discord reply
      rateLimitSafe: true
    },
    metadata: {
      description: 'Sends Discord reply responses',
      category: 'communication',
      priority: 'high'
    }
  },

  // === FUTURE PLUGINS (Examples) ===
  
  // channel_search: {
  //   type: 'tool',
  //   handler: ChannelSearchTool,
  //   triggers: ['search_request', 'find_message'],
  //   dependencies: ['discordClient'],
  //   config: { maxResults: 10 }
  // },
  
  // delayed_response: {
  //   type: 'action', 
  //   handler: DelayedResponseAction,
  //   triggers: ['delayed_respond'],
  //   dependencies: ['discordClient', 'scheduler'],
  //   config: { maxDelay: 300000 }
  // }
};

/**
 * Get all plugin definitions
 */
function getPluginDefinitions() {
  return PLUGIN_DEFINITIONS;
}

/**
 * Get plugins by type
 */
function getPluginsByType(type) {
  return Object.entries(PLUGIN_DEFINITIONS)
    .filter(([name, definition]) => definition.type === type)
    .reduce((acc, [name, definition]) => {
      acc[name] = definition;
      return acc;
    }, {});
}

/**
 * Get plugin definition by name
 */
function getPluginDefinition(name) {
  return PLUGIN_DEFINITIONS[name];
}

/**
 * Check if plugin exists
 */
function hasPlugin(name) {
  return name in PLUGIN_DEFINITIONS;
}

/**
 * Get plugins that match specific triggers
 */
function getPluginsByTrigger(trigger) {
  return Object.entries(PLUGIN_DEFINITIONS)
    .filter(([name, definition]) => definition.triggers.includes(trigger))
    .reduce((acc, [name, definition]) => {
      acc[name] = definition;
      return acc;
    }, {});
}

/**
 * Validate plugin definition structure
 */
function validatePluginDefinition(name, definition) {
  const errors = [];

  if (!definition.type || !['tool', 'action', 'behavior'].includes(definition.type)) {
    errors.push(`Invalid type: ${definition.type}`);
  }

  if (!definition.handler) {
    errors.push('Missing handler class');
  }

  if (!definition.triggers || !Array.isArray(definition.triggers)) {
    errors.push('Missing or invalid triggers array');
  }

  if (definition.dependencies && !Array.isArray(definition.dependencies)) {
    errors.push('Dependencies must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get dependency map for all plugins
 */
function getDependencyMap() {
  const depMap = {};
  
  Object.entries(PLUGIN_DEFINITIONS).forEach(([name, definition]) => {
    depMap[name] = definition.dependencies || [];
  });
  
  return depMap;
}

/**
 * Get plugin statistics
 */
function getPluginStats() {
  const stats = {
    totalPlugins: Object.keys(PLUGIN_DEFINITIONS).length,
    byType: {},
    byCategory: {},
    totalDependencies: new Set()
  };

  Object.values(PLUGIN_DEFINITIONS).forEach(definition => {
    // Count by type
    stats.byType[definition.type] = (stats.byType[definition.type] || 0) + 1;
    
    // Count by category
    const category = definition.metadata?.category || 'uncategorized';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    
    // Collect dependencies
    (definition.dependencies || []).forEach(dep => stats.totalDependencies.add(dep));
  });

  stats.uniqueDependencies = stats.totalDependencies.size;
  stats.totalDependencies = Array.from(stats.totalDependencies);

  return stats;
}

/**
 * Generate plugin documentation
 */
function generatePluginDocs() {
  const docs = {
    overview: `Atlas Plugin System - ${Object.keys(PLUGIN_DEFINITIONS).length} plugins available`,
    plugins: {}
  };

  Object.entries(PLUGIN_DEFINITIONS).forEach(([name, definition]) => {
    docs.plugins[name] = {
      name,
      type: definition.type,
      description: definition.metadata?.description || 'No description',
      category: definition.metadata?.category || 'uncategorized',
      triggers: definition.triggers,
      dependencies: definition.dependencies || [],
      config: Object.keys(definition.config || {}),
      priority: definition.metadata?.priority || 'normal'
    };
  });

  return docs;
}

module.exports = {
  getPluginDefinitions,
  getPluginsByType,
  getPluginDefinition,
  hasPlugin,
  getPluginsByTrigger,
  validatePluginDefinition,
  getDependencyMap,
  getPluginStats,
  generatePluginDocs,
  
  // Export for direct access if needed
  PLUGIN_DEFINITIONS
};