/**
 * Base Action interface that all actions must implement
 * Provides standard contract for action execution and Discord interactions
 */
class Action {
  constructor(config = {}, dependencies = {}) {
    this.config = config;
    this.dependencies = dependencies;
    this.name = this.constructor.name;
    this.executionCount = 0;
    this.lastExecuted = null;
    this.successCount = 0;
    this.errorCount = 0;
  }

  /**
   * Execute the action with given context
   * MUST be implemented by all actions
   * @param {Object} context - Execution context (message, decision, Discord client, etc.)
   * @returns {Promise<Object>} Action execution result
   */
  async execute(context) {
    throw new Error(`Action '${this.name}' must implement execute(context) method`);
  }

  /**
   * Check if this action can be executed with the given context
   * @param {Object} context - Execution context
   * @returns {Promise<boolean>} Whether action can execute
   */
  async canExecute(context) {
    return true;
  }

  /**
   * Get action metadata and capabilities
   * @returns {Object} Action metadata
   */
  getMetadata() {
    return {
      name: this.name,
      type: 'action',
      description: 'Base action implementation',
      discordPermissions: [], // Required Discord permissions
      discordFeatures: [], // Discord features used (messages, reactions, etc.)
      estimatedExecutionTime: '1-2s',
      rateLimitSensitive: false
    };
  }

  /**
   * Validate execution context before running
   * @param {Object} context - Execution context
   * @returns {Object} Validation result
   */
  validateContext(context) {
    const result = {
      valid: true,
      errors: []
    };

    // Basic validation
    if (!context) {
      result.valid = false;
      result.errors.push('Context is required');
    }

    if (!context.discordClient) {
      result.valid = false;
      result.errors.push('Discord client is required');
    }

    if (!context.message) {
      result.valid = false;
      result.errors.push('Message context is required');
    }

    return result;
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      name: this.name,
      executionCount: this.executionCount,
      successCount: this.successCount,
      errorCount: this.errorCount,
      successRate: this.executionCount > 0 ? (this.successCount / this.executionCount) * 100 : 0,
      lastExecuted: this.lastExecuted
    };
  }

  /**
   * Handle action lifecycle events
   */
  async onBeforeExecute(context) {
    // Override for pre-execution logic
  }

  async onAfterExecute(context, result) {
    // Override for post-execution logic
    this.executionCount++;
    this.lastExecuted = new Date();
    
    if (result.success) {
      this.successCount++;
    } else {
      this.errorCount++;
    }
  }

  async onError(context, error) {
    // Override for error handling
    this.errorCount++;
    throw error;
  }

  /**
   * Cleanup resources when action is deactivated
   */
  async destroy() {
    // Override for cleanup logic
  }

  // === HELPER METHODS ===

  /**
   * Create standardized action result
   */
  createResult(success, data = null, error = null, metadata = {}) {
    return {
      success,
      data,
      error: error ? error.message : null,
      actionName: this.name,
      timestamp: new Date(),
      executionTime: metadata.executionTime || null,
      discordResponse: metadata.discordResponse || null,
      ...metadata
    };
  }

  /**
   * Create success result
   */
  success(data, metadata = {}) {
    return this.createResult(true, data, null, metadata);
  }

  /**
   * Create error result
   */
  error(error, metadata = {}) {
    return this.createResult(false, null, error, metadata);
  }

  /**
   * Check Discord permissions
   */
  checkDiscordPermissions(message, requiredPermissions = []) {
    if (!requiredPermissions.length) return { valid: true };

    const botMember = message.guild?.members?.cache?.get(message.client.user.id);
    if (!botMember) {
      return { valid: false, missing: ['guild_access'] };
    }

    const missing = [];
    for (const permission of requiredPermissions) {
      if (!botMember.permissions.has(permission)) {
        missing.push(permission);
      }
    }

    return { 
      valid: missing.length === 0, 
      missing 
    };
  }

  /**
   * Wrap execution with timing, error handling, and permissions
   */
  async executeWithMonitoring(context) {
    const startTime = Date.now();
    let result;

    try {
      // Validate context
      const validation = this.validateContext(context);
      if (!validation.valid) {
        throw new Error(`Context validation failed: ${validation.errors.join(', ')}`);
      }

      // Check Discord permissions
      const metadata = this.getMetadata();
      if (metadata.discordPermissions?.length > 0) {
        const permCheck = this.checkDiscordPermissions(context.message, metadata.discordPermissions);
        if (!permCheck.valid) {
          throw new Error(`Missing Discord permissions: ${permCheck.missing.join(', ')}`);
        }
      }

      // Check if action can execute
      const canExecute = await this.canExecute(context);
      if (!canExecute) {
        throw new Error('Action cannot execute with current context');
      }

      // Pre-execution hook
      await this.onBeforeExecute(context);

      // Execute action
      result = await this.execute(context);
      
      // Ensure result follows standard format
      if (!result || typeof result.success !== 'boolean') {
        result = this.success(result);
      }

      // Post-execution hook
      await this.onAfterExecute(context, result);

    } catch (error) {
      // Error hook
      try {
        await this.onError(context, error);
      } catch (hookError) {
        // If error hook fails, use original error
      }
      
      result = this.error(error);
    }

    // Add execution timing
    result.executionTime = Date.now() - startTime;
    
    return result;
  }
}

module.exports = Action;