const PluginRegistry = require('./PluginRegistry');
const EventBus = require('./EventBus');
const logger = require('../../logger/Logger');

/**
 * Configurable decision-making pipeline
 * Coordinates tools, analysis, and decision generation
 */
class DecisionPipeline {
  
  constructor(llmService, dependencies = {}) {
    this.llmService = llmService;
    
    this.dependencies = {
      discordClient: null,
      ...dependencies
    };
    this.stats = {
      decisionsProcessed: 0,
      toolExecutions: 0,
      averageDecisionTime: 0,
      lastDecisionTime: null
    };
  }

  /**
   * Process a message through the full decision pipeline
   */
  async processMessage(message, channelContext, options = {}) {
    const startTime = Date.now();
    
    try {
      EventBus.messageReceived(message, { pipeline: 'decision' });
      
      const decision = await this.makeDecision(message, channelContext, options);
      
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime);
      
      EventBus.messageProcessed(message, decision, { 
        processingTime,
        pipeline: 'decision'
      });
      
      return decision;
    } catch (error) {
      logger.error('Decision pipeline failed', {
        source: 'decision_pipeline',
        messageId: message.id,
        error: error.message
      });
      
      EventBus.systemError(error, { 
        context: 'decision_pipeline',
        messageId: message.id 
      });
      
      // Return fallback decision
      return this.createFallbackDecision(error);
    }
  }

  /**
   * Core decision-making logic with plugin support
   */
  async makeDecision(message, channelContext, options = {}) {
    const startTime = Date.now();
    const decisionContext = {
      message,
      channelContext,
      options,
      toolResults: [],
      pluginResults: [],
      startTime
    };

    // Phase 1: Determine if tools should be used
    const shouldUseTools = await this.shouldExecuteTools(message, channelContext);
    
    if (shouldUseTools) {
      // Execute tools for context enhancement
      decisionContext.toolResults = await this.executeRelevantTools(message, channelContext);
    }

    // Phase 2: Generate decision using plugin system and/or LLM
    let decision;
    try {
      // Try plugin-based decision first
      decision = await this.generatePluginDecision(decisionContext);
      
      if (!decision || decision.action === 'uncertain') {
        // Fallback to LLM decision
        decision = await this.generateLLMDecision(decisionContext);
      }
    } catch (error) {
      logger.warn('Decision generation failed, using fallback', {
        source: 'decision_pipeline',
        error: error.message
      });
      decision = this.createFallbackDecision(error);
    }

    // Phase 3: Validate and enhance the decision
    const finalDecision = await this.validateDecision(decision, decisionContext);
    
    return finalDecision;
  }

  /**
   * Generate decision using LLM service
   */
  async generateLLMDecision(context) {
    try {
      // Build simple prompt for decision making
      const prompt = this.buildDecisionPrompt(context);
      
      const result = await this.llmService.generateCustomResponse(prompt, {
        temperature: 0.3,
        max_tokens: 200
      });

      if (result.success) {
        return this.parseDecisionResponse(result.response);
      }

      return this.createFallbackDecision(new Error('LLM decision failed'));
    } catch (error) {
      logger.error('LLM decision generation failed', {
        source: 'decision_pipeline',
        error: error.message
      });
      return this.createFallbackDecision(error);
    }
  }

  /**
   * Build simple decision prompt
   */
  buildDecisionPrompt(context) {
    const { message, channelContext } = context;
    
    let prompt = `You are an AI bot deciding how to respond to a Discord message.

Message: "${message.content}"
Author: ${message.author?.username || 'Unknown'}
Channel: ${channelContext.channelName || 'Unknown'}

Choose ONE action:
- respond: Send a conversational response
- reply: Reply to their message specifically  
- react: Add emoji reaction
- ignore: Take no action

Respond with just: ACTION: [your choice]
REASONING: [brief explanation]`;

    // Add tool results if available
    if (context.toolResults && context.toolResults.length > 0) {
      prompt += `\n\nTool information:\n`;
      context.toolResults.forEach(result => {
        prompt += `- ${result.tool}: ${result.summary || result.data}\n`;
      });
    }

    return prompt;
  }

  /**
   * Parse LLM decision response
   */
  parseDecisionResponse(response) {
    const actionMatch = response.match(/ACTION:\s*(\w+)/i);
    const reasoningMatch = response.match(/REASONING:\s*(.+)/i);
    
    return {
      action: actionMatch ? actionMatch[1].toLowerCase() : 'ignore',
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided',
      confidence: 0.7,
      source: 'llm_pipeline'
    };
  }

  /**
   * Generate decision using plugin system
   */
  async generatePluginDecision(context) {
    // Check if any decision plugins are available
    const decisionPlugins = PluginRegistry.getPluginsByType('decision');
    
    if (decisionPlugins.length === 0) {
      return null; // No decision plugins available
    }

    // Execute first available decision plugin
    try {
      const plugin = decisionPlugins[0];
      const result = await PluginRegistry.executePlugin(
        plugin.name, 
        context, 
        Object.fromEntries(this.dependencies)
      );

      if (result.success && result.data) {
        return {
          ...result.data,
          source: 'plugin_decision'
        };
      }
    } catch (error) {
      logger.warn('Plugin decision failed', {
        source: 'decision_pipeline',
        error: error.message
      });
    }

    return null;
  }

  /**
   * Determine if tools should be executed
   */
  async shouldExecuteTools(message, channelContext) {
    // Simple heuristics for tool usage
    const messageContent = message.content?.toLowerCase() || '';
    
    // Execute tools if message mentions users or asks questions
    return messageContent.includes('@') || 
           messageContent.includes('?') ||
           messageContent.includes('who is') ||
           messageContent.includes('profile');
  }

  /**
   * Execute relevant tools based on context
   */
  async executeRelevantTools(message, channelContext) {
    const results = [];
    const availableTools = PluginRegistry.getPluginsByType('tool');

    for (const toolDefinition of availableTools) {
      try {
        // Check if this tool should be executed
        const shouldExecute = await this.shouldExecuteTool(toolDefinition, message, channelContext);
        
        if (shouldExecute) {
          const context = {
            message,
            channelContext,
            originalMessage: message._originalMessage
          };

          const toolResult = await PluginRegistry.executeTool(
            toolDefinition.name,
            context,
            Object.fromEntries(this.dependencies)
          );

          if (toolResult.success) {
            results.push({
              tool: toolDefinition.name,
              success: true,
              data: toolResult.data,
              summary: toolResult.data?.summary || 'Tool executed successfully'
            });
          } else {
            results.push({
              tool: toolDefinition.name,
              success: false,
              error: toolResult.error,
              summary: `Failed: ${toolResult.error}`
            });
          }
        }
      } catch (error) {
        logger.error('Tool execution failed in pipeline', {
          source: 'decision_pipeline',
          tool: toolDefinition.name,
          error: error.message
        });

        results.push({
          tool: toolDefinition.name,
          success: false,
          error: error.message,
          summary: `Failed: ${error.message}`
        });
      }
    }

    return results;
  }

  /**
   * Determine if a specific tool should be executed
   */
  async shouldExecuteTool(toolDefinition, message, channelContext) {
    // For now, execute all available tools when tool execution is triggered
    // Future: Implement tool-specific triggering logic based on toolDefinition.triggers
    return true;
  }

  /**
   * Validate and enhance the generated decision
   */
  async validateDecision(decision, context) {
    // Basic validation
    if (!decision.action) {
      decision.action = 'ignore';
      decision.reasoning = 'No action determined, defaulting to ignore';
    }

    // Ensure action is supported
    const supportedActions = ['respond', 'reply', 'react', 'ignore', 'status_change'];
    if (!supportedActions.includes(decision.action)) {
      logger.warn('Unsupported action in decision', {
        source: 'decision_pipeline',
        action: decision.action,
        fallback: 'ignore'
      });
      
      decision.action = 'ignore';
      decision.reasoning = `Unsupported action, defaulting to ignore`;
    }

    // Add metadata
    decision.metadata = {
      pipelineVersion: '2.0',
      toolsUsed: context.toolResults.length > 0,
      toolCount: context.toolResults.length,
      processingTime: Date.now() - context.startTime
    };

    return decision;
  }

  /**
   * Create fallback decision for error cases
   */
  createFallbackDecision(error) {
    return {
      action: 'ignore',
      reasoning: `Error in decision pipeline: ${error.message}`,
      confidence: 0.1,
      source: 'fallback',
      error: error.message
    };
  }

  /**
   * Get available tools count
   */
  getAvailableTools() {
    return PluginRegistry.getPluginsByType('tool').length;
  }

  /**
   * Update pipeline statistics
   */
  updateStats(processingTime) {
    this.stats.decisionsProcessed++;
    this.stats.lastDecisionTime = Date.now();
    
    if (this.stats.averageDecisionTime === 0) {
      this.stats.averageDecisionTime = processingTime;
    } else {
      this.stats.averageDecisionTime = 
        (this.stats.averageDecisionTime + processingTime) / 2;
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      ...this.stats,
      availableTools: this.getAvailableTools()
    };
  }
}

module.exports = DecisionPipeline;