const DecisionMaker = require('./decision/DecisionMaker');
const ContextAnalyzer = require('./decision/ContextAnalyzer');
const DecisionParser = require('./decision/DecisionParser');
const DecisionTracker = require('./decision/DecisionTracker');
const ConversationHistoryLoader = require('../discord/conversation/ConversationHistoryLoader');
const ToolExecutor = require('../discord/tools/ToolExecutor');
const logger = require('../logger/Logger');

class MultiLLMDecisionEngine {
  constructor() {
    this.contextAnalyzer = new ContextAnalyzer();
    this.decisionMaker = new DecisionMaker();
    this.decisionParser = new DecisionParser();
    this.decisionTracker = new DecisionTracker();
    this.historyLoader = null; // Initialize as null, will be set when needed
    this.toolExecutor = null; // Will be initialized when Discord services are available

    // Tool execution configuration
    this.maxToolActions = 3; // Failsafe: max tool actions before forcing final decision
    this.toolTimeout = 10000; // 10 seconds timeout for tool execution

    logger.info('Multi-LLM Decision Engine initialized with tool support', {
      source: 'llm',
      features: ['QuickDecision', 'FullResponse', 'BackgroundAnalysis', 'ImageContext', 'ToolExecution'],
      maxToolActions: this.maxToolActions,
      toolTimeout: this.toolTimeout
    });
  }

  // Initialize tool executor (called by MessageProcessor)
  initializeToolExecutor(discordClient, conversationManager) {
    this.toolExecutor = new ToolExecutor(discordClient, conversationManager);
    logger.info('Tool executor initialized', {
      source: 'llm',
      availableTools: this.toolExecutor.getAvailableTools()
    });
  }

  /**
   * Main decision making entry point with tool support
   */
  async makeDecision(context) {
    try {
      // Check if we need to load recent conversation history on-demand
      await this.ensureConversationHistory(context);

      // Analyze the context for decision making
      const analysisContext = this.contextAnalyzer.analyzeContext(context);

      // Start the decision chain
      const finalDecision = await this.executeDecisionChain(context.message, analysisContext);

      // ENHANCEMENT: Capture the specific message we're deciding about
      finalDecision.originalMessage = {
        id: context.message.id,
        content: context.message.content,
        author: context.message.author.username,
        timestamp: context.message.createdTimestamp
      };

      // Track the decision for analytics
      this.decisionTracker.trackDecision(finalDecision, context);

      return finalDecision;
    } catch (error) {
      logger.error('Decision making failed', {
        source: 'llm',
        error: error.message,
        messageId: context.message?.id || 'unknown',
        hasMessage: !!context.message,
        stack: error.stack
      });
      return this.getDefaultDecision();
    }
  }

  /**
   * Execute decision chain with tool support
   */
  async executeDecisionChain(message, channelContext) {
    const chainStartTime = Date.now();
    const toolResults = [];
    const actionHistory = [];
    let currentDecision = null;
    let toolActionCount = 0;

    try {
      // Make initial decision
      currentDecision = await this.decisionMaker.makeQuickDecision(message, channelContext);
      actionHistory.push({
        action: currentDecision.action,
        reasoning: currentDecision.reasoning,
        confidence: currentDecision.confidence,
        timestamp: new Date().toISOString()
      });

      logger.debug('Initial decision made', {
        source: 'llm',
        action: currentDecision.action,
        confidence: currentDecision.confidence,
        isToolAction: this.decisionParser.isToolAction(currentDecision.action)
      });

      // Execute tool chain if needed
      while (this.decisionParser.isToolAction(currentDecision.action) && toolActionCount < this.maxToolActions) {
        toolActionCount++;

        logger.info(`Executing tool action ${toolActionCount}/${this.maxToolActions}`, {
          source: 'llm',
          tool: currentDecision.action,
          targetUser: currentDecision.targetUser
        });

        // Execute the tool
        const toolResult = await this.executeToolWithTimeout(currentDecision, message);
        toolResults.push(toolResult);

        // Make next decision with tool results
        currentDecision = await this.decisionMaker.makeToolEnhancedDecision(
          message, 
          channelContext, 
          toolResults, 
          actionHistory
        );

        actionHistory.push({
          action: currentDecision.action,
          reasoning: currentDecision.reasoning,
          confidence: currentDecision.confidence,
          timestamp: new Date().toISOString(),
          toolResultsSummary: toolResult.success ? toolResult.summary : `Tool failed: ${toolResult.error}`
        });

        logger.debug(`Decision after tool execution`, {
          source: 'llm',
          toolExecuted: toolResult.tool,
          newAction: currentDecision.action,
          confidence: currentDecision.confidence,
          toolActionCount: toolActionCount
        });
      }

      // Failsafe: If we hit max tool actions, force a final decision
      if (toolActionCount >= this.maxToolActions && this.decisionParser.isToolAction(currentDecision.action)) {
        logger.warn('Tool action limit reached, forcing final decision', {
          source: 'llm',
          toolActionCount: toolActionCount,
          maxActions: this.maxToolActions,
          lastAction: currentDecision.action
        });

        currentDecision = {
          action: 'ignore',
          confidence: 0.3,
          reasoning: `Tool limit reached (${this.maxToolActions} actions), defaulting to ignore`,
          emoji: null,
          status: null,
          targetUser: null
        };
      }

      // Add chain metadata to final decision
      currentDecision.chainMetadata = {
        toolActionCount: toolActionCount,
        totalChainTime: Date.now() - chainStartTime,
        toolResults: toolResults.map(r => ({ tool: r.tool, success: r.success, summary: r.summary })),
        actionHistory: actionHistory
      };

      logger.info('Decision chain completed', {
        source: 'llm',
        finalAction: currentDecision.action,
        toolsUsed: toolActionCount,
        totalTime: `${Date.now() - chainStartTime}ms`,
        chainLength: actionHistory.length
      });

      return currentDecision;

    } catch (error) {
      logger.error('Decision chain failed', {
        source: 'llm',
        error: error.message,
        toolActionCount: toolActionCount,
        chainTime: `${Date.now() - chainStartTime}ms`
      });

      return {
        action: 'ignore',
        confidence: 0.1,
        reasoning: `Decision chain failed: ${error.message}`,
        emoji: null,
        status: null,
        targetUser: null,
        chainMetadata: {
          toolActionCount: toolActionCount,
          totalChainTime: Date.now() - chainStartTime,
          toolResults: toolResults,
          actionHistory: actionHistory,
          error: error.message
        }
      };
    }
  }

  /**
   * Execute tool with timeout protection
   */
  async executeToolWithTimeout(toolAction, message) {
    if (!this.toolExecutor) {
      logger.error('Tool executor not initialized', {
        source: 'llm',
        tool: toolAction.action
      });
      return {
        success: false,
        tool: toolAction.action,
        error: 'Tool executor not initialized',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), this.toolTimeout);
      });

      // Race between tool execution and timeout
      const result = await Promise.race([
        this.toolExecutor.executeTool(toolAction, message),
        timeoutPromise
      ]);

      return result;
    } catch (error) {
      logger.error('Tool execution failed or timed out', {
        source: 'llm',
        tool: toolAction.action,
        error: error.message,
        timeout: this.toolTimeout
      });

      return {
        success: false,
        tool: toolAction.action,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Ensure we have recent conversation history for context-aware decisions
   */
  async ensureConversationHistory(context) {
    try {
      const { conversationHistory = [], conversationManager, messageFilter } = context;
      const channelId = context.message?.channel?.id;

      // If we don't have a valid channel ID, skip history loading
      if (!channelId) {
        logger.warn('No valid channel ID for history loading', {
          source: 'llm',
          hasMessage: !!context.message,
          hasChannel: !!(context.message?.channel)
        });
        return;
      }

      // If we have sufficient recent history, no need to load
      if (conversationHistory.length >= 3) {
        return;
      }

      // Initialize history loader if not exists
      if (!this.historyLoader) {
        // Try to get Discord client safely
        let discordClient = null;
        
        // Try multiple ways to get the Discord client
        if (context.message?.client?.getClient) {
          discordClient = context.message.client.getClient();
        } else if (context.message?.client) {
          discordClient = context.message.client;
        } else if (context.discordClient?.getClient) {
          discordClient = context.discordClient.getClient();
        } else if (context.discordClient) {
          discordClient = context.discordClient;
        }

        if (!discordClient) {
          logger.warn('Cannot initialize conversation history loader - no Discord client available', {
            source: 'llm',
            hasMessageClient: !!(context.message?.client),
            hasContextClient: !!context.discordClient,
            messageClientType: typeof context.message?.client
          });
          return;
        }

        this.historyLoader = new ConversationHistoryLoader(discordClient, messageFilter);
        
        logger.debug('Conversation history loader initialized', {
          source: 'llm',
          hasClient: !!discordClient,
          hasMessageFilter: !!this.historyLoader.messageFilter
        });

        const loaded = await this.historyLoader.loadRecentHistory(channelId, conversationManager);
        
        if (loaded) {
          // Update the context with fresh history
          context.conversationHistory = conversationManager.getHistory(channelId, 10);
          
          logger.success('Decision context enhanced with loaded history', {
            source: 'llm',
            channelId: channelId,
            newHistoryLength: context.conversationHistory.length
          });
        }
      }

    } catch (error) {
      logger.error('Failed to ensure conversation history', {
        source: 'llm',
        error: error.message,
        stack: error.stack,
        channelId: context.message?.channel?.id || 'unknown'
      });
      // Don't fail the decision process if history loading fails
    }
  }

  // Existing methods remain the same...
  async analyzeChannelActivity(recentMessages, channelInfo) {
    try {
      const analysisContext = this.contextAnalyzer.buildChannelAnalysisContext(recentMessages, channelInfo);
      const result = await this.decisionMaker.analyzeChannelActivity(analysisContext);

      if (result.success) {
        return this.decisionParser.parseChannelAnalysis(result.response);
      }

      return { shouldEngage: false, confidence: 0, reasoning: 'Analysis failed' };
    } catch (error) {
      logger.error('Channel analysis failed', {
        source: 'llm',
        error: error.message
      });
      return { shouldEngage: false, confidence: 0, reasoning: 'Error occurred' };
    }
  }

  getDefaultDecision() {
    return this.decisionParser.getDefaultDecision();
  }

  // Add missing method referenced in MultiLLMDecisionEngine
  async makeToolEnhancedDecision(message, channelContext, toolResults, actionHistory) {
    try {
      const prompt = this.promptBuilder.buildToolDecisionPrompt(message, channelContext, toolResults, actionHistory);
      const decisionSettings = this.getDecisionSettings();
      
      logger.debug('Making tool-enhanced decision', {
        source: 'llm',
        task: 'tool_enhanced_decision',
        provider: decisionSettings.provider,
        model: decisionSettings.model,
        toolResultsCount: toolResults ? toolResults.length : 0,
        actionHistoryLength: actionHistory ? actionHistory.length : 0
      });
      
      const result = await this.llmService.generateCustomResponse(prompt, decisionSettings);

      if (result.success) {
        const DecisionParser = require('./DecisionParser');
        const parser = new DecisionParser();
        return parser.parseDecisionResponse(result.response);
      }

      return this.getDefaultDecision();
    } catch (error) {
      logger.error('Tool-enhanced decision failed', {
        source: 'llm',
        task: 'tool_enhanced_decision',
        error: error.message,
        fallback: 'ignore'
      });
      return this.getDefaultDecision();
    }
  }

  getDecisionSettings() {
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};
    
    return {
      provider: llmSettings.decision_provider || llmSettings.provider || 'featherless',
      model: llmSettings.decision_model || llmSettings.model || 'zai-org/GLM-4-9B-0414',
      api_key: llmSettings.decision_api_key || llmSettings.api_key,
      temperature: llmSettings.decision_temperature !== undefined ? parseFloat(llmSettings.decision_temperature) : 0.3,
      max_tokens: llmSettings.decision_max_tokens ? parseInt(llmSettings.decision_max_tokens) : 200,
      top_p: 0.9
    };
  }

  getDefaultDecision() {
    return {
      action: 'ignore',
      confidence: 0.1,
      reasoning: 'Default fallback decision',
      emoji: null,
      status: null,
      targetUser: null
    };
  }

  // Analytics and tracking
  get lastDecisionTime() {
    return this.decisionTracker.getLastDecisionTime();
  }

  timeSinceLastAction() {
    return this.decisionTracker.timeSinceLastAction();
  }

  updateLastActionTime() {
    this.decisionTracker.updateLastActionTime();
  }

  getDecisionStats() {
    const baseStats = this.decisionTracker.getDecisionStats();
    const toolStats = this.toolExecutor ? this.toolExecutor.getStats() : null;
    
    return {
      ...baseStats,
      toolExecution: toolStats
    };
  }

  getDecisionHistory(limit = 10) {
    return this.decisionTracker.getDecisionHistory(limit);
  }

  // Tool management
  getAvailableTools() {
    return this.toolExecutor ? this.toolExecutor.getAvailableTools() : [];
  }

  getToolStats() {
    return this.toolExecutor ? this.toolExecutor.getStats() : null;
  }
}

module.exports = MultiLLMDecisionEngine;