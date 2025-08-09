/**
 * Base Tool interface that all tools must implement
 * Provides standard contract for tool execution and metadata
 */
class Tool {
  constructor(config = {}, dependencies = {}) {
    this.config = config;
    this.dependencies = dependencies;
    this.name = this.constructor.name;
    this.executionCount = 0;
    this.lastExecuted = null;
  }

  /**
   * Execute the tool with given context
   * MUST be implemented by all tools
   * @param {Object} context - Execution context (message, user, channel, etc.)
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(context) {
    throw new Error(`Tool '${this.name}' must implement execute(context) method`);
  }

  /**
   * Check if this tool should be used for the given context
   * Default implementation returns true - override for custom logic
   * @param {Object} context - Execution context
   * @returns {Promise<boolean>} Whether tool should execute
   */
  async shouldExecute(context) {
    return true;
  }

  /**
   * Get tool metadata and capabilities
   * Override to provide tool-specific information
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.name,
      type: 'tool',
      description: 'Base tool implementation',
      capabilities: [],
      requiredPermissions: [],
      estimatedExecutionTime: '1-3s',
      rateLimitInfo: null
    };
  }

  /**
   * Validate execution context before running
   * Override for custom validation logic
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

    return result;
  }

  /**
   * Get execution statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      name: this.name,
      executionCount: this.executionCount,
      lastExecuted: this.lastExecuted,
      averageExecutionTime: this.averageExecutionTime || null,
      successRate: this.successRate || null
    };
  }

  /**
   * Handle tool lifecycle events
   */
  async onBeforeExecute(context) {
    // Override for pre-execution logic
  }

  async onAfterExecute(context, result) {
    // Override for post-execution logic
    this.executionCount++;
    this.lastExecuted = new Date();
  }

  async onError(context, error) {
    // Override for error handling
    throw error;
  }

  /**
   * Cleanup resources when tool is deactivated
   */
  async destroy() {
    // Override for cleanup logic
  }

  // === HELPER METHODS ===

  /**
   * Create standardized tool result
   */
  createResult(success, data = null, error = null, metadata = {}) {
    return {
      success,
      data,
      error: error ? error.message : null,
      toolName: this.name,
      timestamp: new Date(),
      executionTime: metadata.executionTime || null,
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
   * Wrap execution with timing and error handling
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

      // Pre-execution hook
      await this.onBeforeExecute(context);

      // Execute tool
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

module.exports = Tool;