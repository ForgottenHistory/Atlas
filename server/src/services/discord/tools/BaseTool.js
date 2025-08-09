const logger = require('../../logger/Logger');

class BaseTool {
  constructor(name) {
    this.name = name;
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
  }

  async execute(context) {
    const startTime = Date.now();
    
    try {
      logger.debug(`Executing tool: ${this.name}`, {
        source: 'tools',
        tool: this.name,
        context: this.getContextSummary(context)
      });

      // Validate context before execution
      const validation = this.validateContext(context);
      if (!validation.isValid) {
        throw new Error(`Invalid context: ${validation.reason}`);
      }

      // Execute the tool-specific logic
      const result = await this.performExecution(context);

      // Update statistics
      const executionTime = Date.now() - startTime;
      this.updateStats(true, executionTime);

      logger.success(`Tool execution completed: ${this.name}`, {
        source: 'tools',
        tool: this.name,
        executionTime: `${executionTime}ms`,
        resultSummary: this.getResultSummary(result)
      });

      return {
        success: true,
        tool: this.name,
        data: result,
        summary: this.summarizeResult(result),
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(false, executionTime);

      logger.error(`Tool execution failed: ${this.name}`, {
        source: 'tools',
        tool: this.name,
        error: error.message,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        tool: this.name,
        error: error.message,
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Abstract methods - must be implemented by subclasses
  async performExecution(context) {
    throw new Error(`performExecution() must be implemented by ${this.constructor.name}`);
  }

  validateContext(context) {
    throw new Error(`validateContext() must be implemented by ${this.constructor.name}`);
  }

  summarizeResult(result) {
    throw new Error(`summarizeResult() must be implemented by ${this.constructor.name}`);
  }

  // Helper methods
  getContextSummary(context) {
    return {
      hasMessage: !!context.message,
      hasChannel: !!context.channel,
      hasGuild: !!context.guild,
      additionalData: Object.keys(context).filter(key => 
        !['message', 'channel', 'guild', 'discordClient'].includes(key)
      )
    };
  }

  getResultSummary(result) {
    if (!result) return 'No result';
    if (typeof result === 'string') return result.substring(0, 100);
    if (typeof result === 'object') return `Object with ${Object.keys(result).length} properties`;
    return String(result).substring(0, 100);
  }

  updateStats(success, executionTime) {
    this.executionStats.totalExecutions++;
    this.executionStats.totalExecutionTime += executionTime;
    this.executionStats.averageExecutionTime = 
      this.executionStats.totalExecutionTime / this.executionStats.totalExecutions;

    if (success) {
      this.executionStats.successfulExecutions++;
    } else {
      this.executionStats.failedExecutions++;
    }
  }

  getStats() {
    return {
      ...this.executionStats,
      successRate: this.executionStats.totalExecutions > 0 
        ? (this.executionStats.successfulExecutions / this.executionStats.totalExecutions) * 100
        : 0
    };
  }

  // Tool metadata
  getToolInfo() {
    return {
      name: this.name,
      description: this.getDescription(),
      requiredContext: this.getRequiredContext(),
      stats: this.getStats()
    };
  }

  getDescription() {
    return 'Base tool class - description not implemented';
  }

  getRequiredContext() {
    return ['message', 'channel'];
  }
}

module.exports = BaseTool;