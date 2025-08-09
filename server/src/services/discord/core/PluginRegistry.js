const logger = require('../../logger/Logger');

/**
 * Central registry for all plugins (tools, actions, behaviors)
 * Enables adding new functionality without modifying core files
 */
class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.pluginsByType = new Map();
    this.dependencies = new Map();
    this.initialized = false;
  }

  /**
   * Register a new plugin
   * @param {string} name - Unique plugin name
   * @param {Object} plugin - Plugin configuration
   * @param {string} plugin.type - Plugin type ('tool', 'action', 'behavior')
   * @param {Function} plugin.handler - Plugin handler class/function
   * @param {Array} plugin.triggers - When this plugin should activate
   * @param {Array} plugin.dependencies - Required dependencies
   * @param {Object} plugin.config - Plugin-specific configuration
   */
  register(name, plugin) {
    try {
      // Validate plugin structure
      this.validatePlugin(name, plugin);

      // Store plugin
      this.plugins.set(name, {
        name,
        type: plugin.type,
        handler: plugin.handler,
        triggers: plugin.triggers || [],
        dependencies: plugin.dependencies || [],
        config: plugin.config || {},
        instance: null, // Will be instantiated when needed
        active: true,
        registeredAt: new Date()
      });

      // Index by type for fast lookup
      if (!this.pluginsByType.has(plugin.type)) {
        this.pluginsByType.set(plugin.type, new Set());
      }
      this.pluginsByType.get(plugin.type).add(name);

      logger.info('Plugin registered successfully', {
        source: 'plugin_registry',
        pluginName: name,
        pluginType: plugin.type,
        triggers: plugin.triggers
      });

      return true;
    } catch (error) {
      logger.error('Failed to register plugin', {
        source: 'plugin_registry',
        pluginName: name,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get plugin by name
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }

  /**
   * Get all plugins of a specific type
   */
  getPluginsByType(type) {
    const pluginNames = this.pluginsByType.get(type) || new Set();
    return Array.from(pluginNames)
      .map(name => this.plugins.get(name))
      .filter(plugin => plugin && plugin.active);
  }

  /**
   * Get plugins that match specific triggers
   */
  getPluginsByTrigger(trigger) {
    const matchingPlugins = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.active && plugin.triggers.includes(trigger)) {
        matchingPlugins.push(plugin);
      }
    }
    
    return matchingPlugins;
  }

  /**
   * Initialize a plugin instance if not already created
   */
  async instantiatePlugin(name, dependencies = {}) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }

    // Return existing instance if available
    if (plugin.instance) {
      return plugin.instance;
    }

    try {
      // Check dependencies
      await this.checkDependencies(plugin, dependencies);

      // Create instance
      if (typeof plugin.handler === 'function') {
        // Class constructor
        plugin.instance = new plugin.handler(plugin.config, dependencies);
      } else if (typeof plugin.handler === 'object') {
        // Object with methods
        plugin.instance = plugin.handler;
      } else {
        throw new Error(`Invalid plugin handler type for '${name}'`);
      }

      logger.info('Plugin instantiated', {
        source: 'plugin_registry',
        pluginName: name,
        pluginType: plugin.type
      });

      return plugin.instance;
    } catch (error) {
      logger.error('Failed to instantiate plugin', {
        source: 'plugin_registry',
        pluginName: name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute a tool plugin
   */
  async executeTool(toolName, context, dependencies = {}) {
    const plugin = this.getPlugin(toolName);
    if (!plugin || plugin.type !== 'tool') {
      throw new Error(`Tool '${toolName}' not found or not a tool`);
    }

    const instance = await this.instantiatePlugin(toolName, dependencies);
    
    if (typeof instance.execute !== 'function') {
      throw new Error(`Tool '${toolName}' does not implement execute() method`);
    }

    return await instance.execute(context);
  }

  /**
   * Execute an action plugin
   */
  async executeAction(actionName, context, dependencies = {}) {
    const plugin = this.getPlugin(actionName);
    if (!plugin || plugin.type !== 'action') {
      throw new Error(`Action '${actionName}' not found or not an action`);
    }

    const instance = await this.instantiatePlugin(actionName, dependencies);
    
    if (typeof instance.execute !== 'function') {
      throw new Error(`Action '${actionName}' does not implement execute() method`);
    }

    return await instance.execute(context);
  }

  /**
   * Deactivate a plugin
   */
  deactivatePlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.active = false;
      plugin.instance = null;
      
      logger.info('Plugin deactivated', {
        source: 'plugin_registry',
        pluginName: name
      });
      
      return true;
    }
    return false;
  }

  /**
   * Reactivate a plugin
   */
  activatePlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.active = true;
      
      logger.info('Plugin activated', {
        source: 'plugin_registry',
        pluginName: name
      });
      
      return true;
    }
    return false;
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const stats = {
      totalPlugins: this.plugins.size,
      activePlugins: 0,
      byType: {}
    };

    for (const plugin of this.plugins.values()) {
      if (plugin.active) {
        stats.activePlugins++;
      }
      
      if (!stats.byType[plugin.type]) {
        stats.byType[plugin.type] = { total: 0, active: 0 };
      }
      
      stats.byType[plugin.type].total++;
      if (plugin.active) {
        stats.byType[plugin.type].active++;
      }
    }

    return stats;
  }

  // === PRIVATE METHODS ===

  validatePlugin(name, plugin) {
    if (!name || typeof name !== 'string') {
      throw new Error('Plugin name must be a non-empty string');
    }

    if (this.plugins.has(name)) {
      throw new Error(`Plugin '${name}' is already registered`);
    }

    if (!plugin.type || !['tool', 'action', 'behavior'].includes(plugin.type)) {
      throw new Error('Plugin type must be "tool", "action", or "behavior"');
    }

    if (!plugin.handler) {
      throw new Error('Plugin must have a handler');
    }

    if (plugin.dependencies && !Array.isArray(plugin.dependencies)) {
      throw new Error('Plugin dependencies must be an array');
    }

    if (plugin.triggers && !Array.isArray(plugin.triggers)) {
      throw new Error('Plugin triggers must be an array');
    }
  }

  async checkDependencies(plugin, availableDependencies) {
    for (const depName of plugin.dependencies) {
      if (!availableDependencies[depName]) {
        throw new Error(`Missing required dependency: ${depName}`);
      }
    }
  }
}

// Export singleton instance
module.exports = new PluginRegistry();