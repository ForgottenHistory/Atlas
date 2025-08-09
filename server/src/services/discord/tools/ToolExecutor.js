const ProfileLookupTool = require('./ProfileLookupTool');
const logger = require('../../logger/Logger');

class ToolExecutor {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    
    // Initialize available tools
    this.tools = new Map();
    this.initializeTools();
    
    // Execution statistics
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      toolUsageStats: {},
      lastExecutionTime: null
    };

    logger.info('ToolExecutor initialized', {
      source: 'tools',
      availableTools: Array.from(this.tools.keys())
    });
  }

  initializeTools() {
    // Register all available tools
    const profileLookup = new ProfileLookupTool(this.discordClient, this.conversationManager);
    this.tools.set('profile_lookup', profileLookup);

    logger.debug('Tools registered', {
      source: 'tools',
      toolCount: this.tools.size,
      tools: Array.from(this.tools.keys())
    });
  }

  async executeTool(toolAction, message, additionalContext = {}) {
    const startTime = Date.now();
    
    try {
      // Validate tool action
      const validation = this.validateToolAction(toolAction);
      if (!validation.isValid) {
        throw new Error(`Invalid tool action: ${validation.reason}`);
      }

      // Get the appropriate tool
      const tool = this.tools.get(toolAction.action);
      if (!tool) {
        throw new Error(`Tool not found: ${toolAction.action}`);
      }

      // Build execution context
      const context = this.buildToolContext(toolAction, message, additionalContext);

      logger.debug(`Executing tool: ${toolAction.action}`, {
        source: 'tools',
        tool: toolAction.action,
        targetUser: toolAction.targetUser,
        channelId: message.channel.id
      });

      // Execute the tool
      const result = await tool.execute(context);

      // Update statistics
      this.updateStats(toolAction.action, result.success, Date.now() - startTime);

      if (result.success) {
        logger.success(`Tool execution completed: ${toolAction.action}`, {
          source: 'tools',
          tool: toolAction.action,
          executionTime: `${Date.now() - startTime}ms`,
          resultSummary: result.summary
        });
      } else {
        logger.error(`Tool execution failed: ${toolAction.action}`, {
          source: 'tools',
          tool: toolAction.action,
          error: result.error,
          executionTime: `${Date.now() - startTime}ms`
        });
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(toolAction.action, false, executionTime);

      logger.error('Tool execution error', {
        source: 'tools',
        tool: toolAction.action,
        error: error.message,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        tool: toolAction.action,
        error: error.message,
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  buildToolContext(toolAction, message, additionalContext) {
    // Defensive programming: ensure message properties exist
    const safeMessage = message || {};
    const safeChannel = safeMessage.channel || {};
    const safeAuthor = safeMessage.author || {};
    const safeGuild = safeMessage.guild || null;

    const context = {
      message: {
        id: safeMessage.id || 'unknown',
        content: safeMessage.content || '',
        author: {
          username: safeAuthor.username || 'Unknown',
          id: safeAuthor.id || 'unknown'
        },
        channel: {
          id: safeChannel.id || 'unknown',
          name: safeChannel.name || 'Unknown'
        },
        guild: safeGuild
      },
      channel: safeChannel,
      guild: safeGuild,
      author: safeAuthor,
      discordClient: this.discordClient,
      conversationManager: this.conversationManager,
      ...additionalContext
    };

    // Add tool-specific context based on action type
    switch (toolAction.action) {
      case 'profile_lookup':
        context.targetUser = toolAction.targetUser || toolAction.target_user;
        break;
      
      // Future tools can add their context here
      default:
        break;
    }

    return context;
  }

  validateToolAction(toolAction) {
    if (!toolAction || typeof toolAction !== 'object') {
      return { isValid: false, reason: 'Tool action must be an object' };
    }

    if (!toolAction.action) {
      return { isValid: false, reason: 'Tool action must have an action property' };
    }

    if (!this.tools.has(toolAction.action)) {
      return { isValid: false, reason: `Unknown tool: ${toolAction.action}` };
    }

    // Tool-specific validation
    switch (toolAction.action) {
      case 'profile_lookup':
        if (!toolAction.targetUser && !toolAction.target_user) {
          return { isValid: false, reason: 'profile_lookup requires targetUser' };
        }
        break;
    }

    return { isValid: true };
  }

  updateStats(toolName, success, executionTime) {
    this.stats.totalExecutions++;
    this.stats.lastExecutionTime = new Date();

    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }

    // Update tool-specific stats
    if (!this.stats.toolUsageStats[toolName]) {
      this.stats.toolUsageStats[toolName] = {
        total: 0,
        successful: 0,
        failed: 0,
        averageExecutionTime: 0,
        totalExecutionTime: 0
      };
    }

    const toolStats = this.stats.toolUsageStats[toolName];
    toolStats.total++;
    toolStats.totalExecutionTime += executionTime;
    toolStats.averageExecutionTime = toolStats.totalExecutionTime / toolStats.total;

    if (success) {
      toolStats.successful++;
    } else {
      toolStats.failed++;
    }
  }

  // Utility methods
  getAvailableTools() {
    return Array.from(this.tools.keys());
  }

  getToolInfo(toolName) {
    const tool = this.tools.get(toolName);
    return tool ? tool.getToolInfo() : null;
  }

  getAllToolsInfo() {
    const toolsInfo = {};
    for (const [name, tool] of this.tools) {
      toolsInfo[name] = tool.getToolInfo();
    }
    return toolsInfo;
  }

  getStats() {
    const successRate = this.stats.totalExecutions > 0 
      ? (this.stats.successfulExecutions / this.stats.totalExecutions) * 100
      : 0;

    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      availableTools: this.getAvailableTools()
    };
  }

  // Register new tools dynamically
  registerTool(name, tool) {
    this.tools.set(name, tool);
    logger.info('Tool registered', {
      source: 'tools',
      toolName: name,
      totalTools: this.tools.size
    });
  }

  // Remove tools
  unregisterTool(name) {
    const removed = this.tools.delete(name);
    if (removed) {
      logger.info('Tool unregistered', {
        source: 'tools',
        toolName: name,
        totalTools: this.tools.size
      });
    }
    return removed;
  }
}

module.exports = ToolExecutor;