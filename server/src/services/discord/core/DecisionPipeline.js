const PluginRegistry = require('./PluginRegistry');
const EventBus = require('./EventBus');
// FIX: Use PromptBuilder instead of DecisionBuilder (same as DecisionMaker)
const PromptBuilder = require('../../llm/decision/PromptBuilder');
const logger = require('../../logger/Logger');

/**
 * Configurable decision-making pipeline
 * Coordinates tools, analysis, and decision generation
 */
class DecisionPipeline {
  
  constructor(llmService, dependencies = {}) {
    this.llmService = llmService;
    
    // FIX: Initialize promptBuilder (same as DecisionMaker)
    this.promptBuilder = new PromptBuilder();
    
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
      this.stats.toolExecutions += decisionContext.toolResults.length;
      
      // Log tool execution results
      for (const toolResult of decisionContext.toolResults) {
        EventBus.toolExecuted(toolResult.tool, toolResult, { messageId: message.id });
      }
    }

    // Phase 2: Generate decision with available context
    const decision = await this.generateDecision(message, channelContext, decisionContext.toolResults);
    
    // Phase 3: Validate and enhance decision
    const validatedDecision = await this.validateDecision(decision, decisionContext);
    
    this.stats.decisionsProcessed++;
    this.stats.lastDecisionTime = new Date();
    
    // Log decision made
    EventBus.decisionMade(validatedDecision, {
      toolsUsed: shouldUseTools,
      toolCount: decisionContext.toolResults.length,
      messageId: message.id
    });
    
    return validatedDecision;
  }

  /**
   * FIX: Generate decision using proper DecisionMaker-compatible methods
   */
  async generateDecision(message, channelContext, toolResults = []) {
    // Build decision prompt - use tool prompt if we have tool results
    const prompt = toolResults.length > 0 
      ? this.promptBuilder.buildToolDecisionPrompt(message, channelContext, toolResults, [])
      : this.promptBuilder.buildQuickDecisionPrompt(message, channelContext);

    // Generate decision via LLM - use correct method from actual LLM service
    if (!this.llmService) {
      throw new Error('LLM service not available for decision generation');
    }

    try {
      // FIX: Use proper decision settings instead of hardcoded ones
      const decisionSettings = this.getDecisionSettings();
      
      const result = await this.llmService.generateCustomResponse(prompt, decisionSettings);
      
      if (result.success) {
        // Parse the decision from the response (same as DecisionMaker)
        const decision = this.parseDecisionResponse(result.response);
        
        logger.debug('Decision generated via plugin system', {
          source: 'decision_pipeline',
          toolCount: toolResults.length,
          decision: decision.action,
          model: decisionSettings.model,
          provider: decisionSettings.provider
        });

        return {
          action: decision.action,
          reasoning: decision.reasoning,
          confidence: decision.confidence || 0.8,
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
        toolResults,
        error: true,
        timestamp: new Date()
      };
    }
  }

  /**
   * FIX: Get decision-specific settings (same as DecisionMaker)
   */
  getDecisionSettings() {
    const storage = require('../../../utils/storage');
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};
    
    // Use separate decision model settings if available, otherwise fallback to main settings
    return {
      provider: llmSettings.decision_provider || llmSettings.provider || 'featherless',
      model: llmSettings.decision_model || llmSettings.model || 'zai-org/GLM-4-9B-0414',
      api_key: llmSettings.decision_api_key || llmSettings.api_key,
      temperature: llmSettings.decision_temperature !== undefined ? parseFloat(llmSettings.decision_temperature) : 0.3,
      max_tokens: llmSettings.decision_max_tokens ? parseInt(llmSettings.decision_max_tokens) : 200,
      top_p: llmSettings.decision_top_p !== undefined ? parseFloat(llmSettings.decision_top_p) : 0.9
    };
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
   * Determine if tools should be executed for this message
   */
  async shouldExecuteTools(message, channelContext) {
    // Simple heuristics for tool usage
    const triggers = {
      trigger_0: this.hasToolTriggerKeywords(message.content),
      trigger_1: channelContext.activityLevel === 'high',
      trigger_2: message.author && !message.author.bot,
      trigger_3: this.shouldAnalyzeBasedOnTiming(channelContext),
      trigger_4: (channelContext.conversationHistory || []).length < 3
    };

    const shouldUse = Object.values(triggers).filter(Boolean).length >= 2;

    logger.debug('Tool execution decision', {
      source: 'decision_pipeline',
      shouldUse,
      triggers: Object.entries(triggers).map(([k, v]) => ({ [k]: v })),
      availableTools: this.getAvailableTools()
    });

    return shouldUse;
  }

  /**
   * Execute relevant tools for the current context
   */
  async executeRelevantTools(message, channelContext) {
    const results = [];
    const availableTools = PluginRegistry.getPluginsByType('tool');

    for (const toolDefinition of availableTools) {
      try {
        const shouldExecute = await this.shouldExecuteTool(toolDefinition, message, channelContext);
        
        if (shouldExecute) {
          // Use PluginRegistry.executeTool() which handles instantiation properly
          const toolResult = await PluginRegistry.executeTool(toolDefinition.name, {
            message,
            channelContext,
            discordClient: this.dependencies.discordClient
          }, this.dependencies);

          results.push({
            tool: toolDefinition.name,
            success: toolResult.success,
            data: toolResult.data,
            summary: this.summarizeToolResult(toolResult)
          });

          logger.debug('Tool executed in pipeline', {
            source: 'decision_pipeline',
            tool: toolDefinition.name,
            success: toolResult.success,
            hasData: !!toolResult.data
          });
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
   * Get available tools count
   */
  getAvailableTools() {
    return PluginRegistry.getPluginsByType('tool').length;
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
    
    return 'Success';
  }

  updateStats(processingTime) {
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
}

module.exports = DecisionPipeline;