const PluginRegistry = require('./PluginRegistry');
const EventBus = require('./EventBus');
const DecisionBuilder = require('../../llm/builders/DecisionBuilder');
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
    const decisionContext = {
      message,
      channelContext,
      options,
      toolResults: [],
      pluginResults: []
    };

    // Phase 1: Determine if tools should be used
    const shouldUseTools = await this.shouldExecuteTools(message, channelContext);
    
    if (shouldUseTools) {
      // Phase 2: Execute relevant tools/plugins
      decisionContext.toolResults = await this.executeTools(message, channelContext);
      decisionContext.pluginResults = decisionContext.toolResults; // Compatible format
    }

    // Phase 3: Generate decision with context
    const decision = await this.generateDecision(decisionContext);
    
    // Phase 4: Validate and enhance decision
    const validatedDecision = await this.validateDecision(decision, decisionContext);
    
    EventBus.decisionMade(validatedDecision, {
      toolsUsed: shouldUseTools,
      toolCount: decisionContext.toolResults.length
    });
    
    return validatedDecision;
  }

  /**
   * Determine if tools should be executed for this message
   */
  async shouldExecuteTools(message, channelContext) {
    // Get all available tool plugins
    const toolPlugins = PluginRegistry.getPluginsByType('tool');
    
    if (toolPlugins.length === 0) {
      return false;
    }

    // Simple heuristics - can be made more sophisticated
    const triggers = [
      // User mentions
      message.mentions?.users?.size > 0,
      
      // Direct replies
      message.reference !== null,
      
      // Channel activity patterns
      channelContext.activityLevel === 'high',
      
      // Time since last action
      this.shouldAnalyzeBasedOnTiming(channelContext),
      
      // Keyword triggers
      this.hasToolTriggerKeywords(message.content)
    ];

    const shouldUse = triggers.some(trigger => trigger);
    
    logger.debug('Tool execution decision', {
      source: 'decision_pipeline',
      shouldUse,
      triggers: triggers.map((t, i) => ({ [`trigger_${i}`]: t })),
      availableTools: toolPlugins.length
    });

    return shouldUse;
  }

  /**
   * Execute relevant tools based on message context
   */
  async executeTools(message, channelContext) {
    const toolPlugins = PluginRegistry.getPluginsByType('tool');
    const results = [];
    
    // Execute tools concurrently
    const toolPromises = toolPlugins.map(async (plugin) => {
      try {
        const context = {
          message,
          channelContext,
          discordClient: this.dependencies.discordClient
        };
        
        // Check if tool should execute for this context
        const instance = await PluginRegistry.instantiatePlugin(plugin.name, this.dependencies);
        if (typeof instance.shouldExecute === 'function') {
          const shouldExecute = await instance.shouldExecute(context);
          if (!shouldExecute) {
            return null;
          }
        }
        
        // Execute tool
        const result = await PluginRegistry.executeTool(plugin.name, context, this.dependencies);
        
        EventBus.toolExecuted(plugin.name, result, { messageId: message.id });
        this.stats.toolExecutions++;
        
        return {
          pluginName: plugin.name,
          toolName: plugin.name,
          success: result.success,
          data: result.data,
          summary: this.summarizeToolResult(result),
          executionTime: result.executionTime
        };
      } catch (error) {
        logger.error('Tool execution failed', {
          source: 'decision_pipeline',
          toolName: plugin.name,
          error: error.message
        });
        
        return {
          pluginName: plugin.name,
          toolName: plugin.name,
          success: false,
          error: error.message,
          data: null
        };
      }
    });

    const toolResults = await Promise.all(toolPromises);
    return toolResults.filter(result => result !== null);
  }

  /**
   * Generate decision using appropriate prompt template
   */
  async generateDecision(decisionContext) {
    const { message, channelContext, toolResults } = decisionContext;
    
    // Choose prompt type based on context
    let promptType = 'quick';
    if (toolResults.length > 0) {
      promptType = 'plugin_enhanced';
    }
    
    // Build decision prompt
    const prompt = DecisionBuilder.buildDecisionPrompt(promptType, {
      message,
      channelContext,
      toolResults
    });

    // Generate decision via LLM - use correct method from actual LLM service
    if (!this.llmService) {
      throw new Error('LLM service not available for decision generation');
    }

    try {
      // Use the actual LLM service method like DecisionMaker does
      const decisionSettings = {
        temperature: 0.3,
        max_tokens: 200,
        top_p: 0.9
      };
      
      const result = await this.llmService.generateCustomResponse(prompt, decisionSettings);
      
      if (result.success) {
        // Parse the decision from the response (same as DecisionMaker)
        const decision = this.parseDecisionResponse(result.response);
        
        logger.debug('Decision generated via plugin system', {
          source: 'decision_pipeline',
          promptType,
          toolCount: toolResults.length,
          decision: decision.action
        });

        return {
          action: decision.action,
          reasoning: decision.reasoning,
          confidence: decision.confidence || 0.8,
          promptType,
          toolResults,
          timestamp: new Date()
        };
      } else {
        throw new Error(result.error || 'LLM generation failed');
      }
    } catch (error) {
      logger.error('LLM decision generation failed', {
        source: 'decision_pipeline',
        error: error.message
      });
      
      // Return fallback decision
      return {
        action: 'ignore',
        reasoning: 'LLM decision generation failed, using fallback',
        confidence: 0.1,
        promptType,
        toolResults,
        error: true,
        timestamp: new Date()
      };
    }
  }

  /**
   * Parse decision response from LLM (simple parser)
   */
  parseDecisionResponse(response) {
    try {
      // Simple parsing - look for ACTION: line
      const actionMatch = response.match(/ACTION:\s*(\w+)/i);
      const reasoningMatch = response.match(/REASONING:\s*(.+?)(?:\n|$)/i);
      const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
      
      return {
        action: actionMatch ? actionMatch[1].toLowerCase() : 'ignore',
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided',
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5
      };
    } catch (error) {
      logger.error('Failed to parse decision response', {
        source: 'decision_pipeline',
        error: error.message,
        response: response.substring(0, 100)
      });
      
      return {
        action: 'ignore',
        reasoning: 'Failed to parse LLM response',
        confidence: 0.1
      };
    }
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
      error: true,
      timestamp: new Date(),
      metadata: {
        pipelineVersion: '2.0',
        fallback: true
      }
    };
  }

  // === HELPER METHODS ===

  shouldAnalyzeBasedOnTiming(channelContext) {
    if (!channelContext.lastActionTime) return true;
    
    const timeSinceLastAction = Date.now() - new Date(channelContext.lastActionTime).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    return timeSinceLastAction > fiveMinutes;
  }

  hasToolTriggerKeywords(content) {
    if (!content) return false;
    
    const keywords = ['profile', 'user', 'activity', 'history', 'status', 'info'];
    const lowerContent = content.toLowerCase();
    
    return keywords.some(keyword => lowerContent.includes(keyword));
  }

  summarizeToolResult(result) {
    if (!result.success) {
      return `Failed: ${result.error}`;
    }
    
    if (typeof result.data === 'string') {
      return result.data.substring(0, 100) + (result.data.length > 100 ? '...' : '');
    }
    
    if (typeof result.data === 'object') {
      return `Object with ${Object.keys(result.data).length} properties`;
    }
    
    return 'Tool executed successfully';
  }

  updateStats(processingTime) {
    this.stats.decisionsProcessed++;
    this.stats.lastDecisionTime = processingTime;
    
    // Update rolling average
    if (this.stats.averageDecisionTime === 0) {
      this.stats.averageDecisionTime = processingTime;
    } else {
      this.stats.averageDecisionTime = (this.stats.averageDecisionTime + processingTime) / 2;
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      decisionsProcessed: 0,
      toolExecutions: 0,
      averageDecisionTime: 0,
      lastDecisionTime: null
    };
  }
}

module.exports = DecisionPipeline;