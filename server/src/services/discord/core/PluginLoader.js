const PluginRegistry = require('./PluginRegistry');
const PluginConfiguration = require('../plugins/PluginConfiguration');
const EventBus = require('./EventBus');
const logger = require('../../logger/Logger');

/**
 * Automatic plugin loader
 * Registers all plugins from configuration with zero core changes needed
 */
class PluginLoader {
  
  constructor() {
    this.loadedPlugins = new Set();
    this.failedPlugins = new Set();
    this.dependencies = new Map();
  }

  /**
   * Load all plugins from configuration
   */
  async loadAllPlugins(dependencies = {}) {
    logger.info('Starting plugin loading process', {
      source: 'plugin_loader',
      totalPlugins: Object.keys(PluginConfiguration.getPluginDefinitions()).length
    });

    // Store dependencies for plugin instantiation
    this.dependencies = new Map(Object.entries(dependencies));
    
    const pluginDefinitions = PluginConfiguration.getPluginDefinitions();
    const loadResults = {
      loaded: 0,
      failed: 0,
      errors: []
    };

    // Load plugins in dependency order
    const loadOrder = this.calculateLoadOrder(pluginDefinitions);
    
    for (const pluginName of loadOrder) {
      try {
        await this.loadPlugin(pluginName, pluginDefinitions[pluginName]);
        loadResults.loaded++;
        this.loadedPlugins.add(pluginName);
        
        // Emit plugin registered event
        EventBus.pluginRegistered(pluginName, pluginDefinitions[pluginName].type);
        
      } catch (error) {
        logger.error('Failed to load plugin', {
          source: 'plugin_loader',
          pluginName,
          error: error.message
        });
        
        loadResults.failed++;
        loadResults.errors.push({ pluginName, error: error.message });
        this.failedPlugins.add(pluginName);
      }
    }

    logger.info('Plugin loading completed', {
      source: 'plugin_loader',
      loaded: loadResults.loaded,
      failed: loadResults.failed,
      totalPlugins: Object.keys(pluginDefinitions).length
    });

    if (loadResults.failed > 0) {
      logger.warn('Some plugins failed to load', {
        source: 'plugin_loader',
        failedPlugins: Array.from(this.failedPlugins),
        errors: loadResults.errors
      });
    }

    return loadResults;
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(pluginName, pluginDefinition) {
    // Validate plugin definition
    const validation = PluginConfiguration.validatePluginDefinition(pluginName, pluginDefinition);
    if (!validation.valid) {
      throw new Error(`Invalid plugin definition: ${validation.errors.join(', ')}`);
    }

    // Check dependencies
    const missingDeps = this.checkDependencies(pluginDefinition.dependencies || []);
    if (missingDeps.length > 0) {
      throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
    }

    // Register with PluginRegistry
    const success = PluginRegistry.register(pluginName, {
      type: pluginDefinition.type,
      handler: pluginDefinition.handler,
      triggers: pluginDefinition.triggers || [],
      dependencies: pluginDefinition.dependencies || [],
      config: pluginDefinition.config || {}
    });

    if (!success) {
      throw new Error('Failed to register with PluginRegistry');
    }

    logger.debug('Plugin loaded successfully', {
      source: 'plugin_loader',
      pluginName,
      type: pluginDefinition.type,
      triggers: pluginDefinition.triggers
    });
  }

  /**
   * Reload a specific plugin
   */
  async reloadPlugin(pluginName) {
    logger.info('Reloading plugin', {
      source: 'plugin_loader',
      pluginName
    });

    // Deactivate existing plugin
    if (this.loadedPlugins.has(pluginName)) {
      PluginRegistry.deactivatePlugin(pluginName);
      this.loadedPlugins.delete(pluginName);
    }

    // Remove from failed set
    this.failedPlugins.delete(pluginName);

    // Load plugin fresh
    const pluginDefinition = PluginConfiguration.getPluginDefinition(pluginName);
    if (!pluginDefinition) {
      throw new Error(`Plugin definition not found: ${pluginName}`);
    }

    await this.loadPlugin(pluginName, pluginDefinition);
    this.loadedPlugins.add(pluginName);

    logger.success('Plugin reloaded successfully', {
      source: 'plugin_loader',
      pluginName
    });
  }

  /**
   * Add or update dependency
   */
  addDependency(name, dependency) {
    this.dependencies.set(name, dependency);
    
    logger.debug('Dependency added', {
      source: 'plugin_loader',
      dependencyName: name
    });
  }

  /**
   * Remove dependency
   */
  removeDependency(name) {
    const removed = this.dependencies.delete(name);
    
    if (removed) {
      logger.debug('Dependency removed', {
        source: 'plugin_loader',
        dependencyName: name
      });
    }
    
    return removed;
  }

  /**
   * Get current plugin load status
   */
  getLoadStatus() {
    const allPlugins = Object.keys(PluginConfiguration.getPluginDefinitions());
    
    return {
      totalPlugins: allPlugins.length,
      loadedPlugins: Array.from(this.loadedPlugins),
      failedPlugins: Array.from(this.failedPlugins),
      loadedCount: this.loadedPlugins.size,
      failedCount: this.failedPlugins.size,
      successRate: allPlugins.length > 0 ? (this.loadedPlugins.size / allPlugins.length) * 100 : 0
    };
  }

  /**
   * Get available dependencies
   */
  getAvailableDependencies() {
    return Array.from(this.dependencies.keys());
  }

  // === PRIVATE METHODS ===

  /**
   * Calculate load order based on dependencies
   */
  calculateLoadOrder(pluginDefinitions) {
    // For now, simple order - tools first, then actions
    // In future, could implement proper dependency graph resolution
    
    const tools = [];
    const actions = [];
    const behaviors = [];

    Object.entries(pluginDefinitions).forEach(([name, definition]) => {
      switch (definition.type) {
        case 'tool':
          tools.push(name);
          break;
        case 'action':
          actions.push(name);
          break;
        case 'behavior':
          behaviors.push(name);
          break;
        default:
          actions.push(name); // Default to action
      }
    });

    // Load order: tools -> actions -> behaviors
    return [...tools, ...actions, ...behaviors];
  }

  /**
   * Check if all required dependencies are available
   */
  checkDependencies(requiredDeps) {
    const missing = [];
    
    for (const dep of requiredDeps) {
      if (!this.dependencies.has(dep)) {
        missing.push(dep);
      }
    }
    
    return missing;
  }

  /**
   * Get dependencies for plugin instantiation
   */
  getDependenciesForPlugin(requiredDeps) {
    const pluginDeps = {};
    
    for (const dep of requiredDeps) {
      if (this.dependencies.has(dep)) {
        pluginDeps[dep] = this.dependencies.get(dep);
      }
    }
    
    return pluginDeps;
  }

  /**
   * Validate plugin compatibility
   */
  validatePluginCompatibility(pluginDefinition) {
    // Check if handler class exists and is valid
    if (typeof pluginDefinition.handler !== 'function') {
      return { valid: false, reason: 'Handler must be a constructor function' };
    }

    // Check if triggers are valid
    if (!Array.isArray(pluginDefinition.triggers)) {
      return { valid: false, reason: 'Triggers must be an array' };
    }

    return { valid: true };
  }
}

// Export singleton instance
module.exports = new PluginLoader();