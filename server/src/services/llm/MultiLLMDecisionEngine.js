const DecisionMaker = require('./decision/DecisionMaker');
const ContextAnalyzer = require('./decision/ContextAnalyzer');
const DecisionParser = require('./decision/DecisionParser');
const DecisionTracker = require('./decision/DecisionTracker');
const ConversationHistoryLoader = require('../discord/conversation/ConversationHistoryLoader'); // Move this to top
const logger = require('../logger/Logger');

class MultiLLMDecisionEngine {
  constructor() {
    this.contextAnalyzer = new ContextAnalyzer();
    this.decisionMaker = new DecisionMaker();
    this.decisionParser = new DecisionParser();
    this.decisionTracker = new DecisionTracker();
    this.historyLoader = null; // Initialize as null, will be set when needed

    logger.info('Multi-LLM Decision Engine initialized with image awareness', {
      source: 'llm',
      features: ['QuickDecision', 'FullResponse', 'BackgroundAnalysis', 'ImageContext']
    });
  }

  /**
   * Main decision making entry point - handles both regular messages and images
   */
  async makeDecision(context) {
    try {
      // Check if we need to load recent conversation history on-demand
      await this.ensureConversationHistory(context);

      // Analyze the context for decision making
      const analysisContext = this.contextAnalyzer.analyzeContext(context);

      // Make the decision using LLM
      const decision = await this.decisionMaker.makeQuickDecision(context.message, analysisContext);

      // ENHANCEMENT: Capture the specific message we're deciding about
      // This ensures we always know exactly which message to reply to
      decision.originalMessage = {
        id: context.message.id,
        content: context.message.content,
        author: context.message.author.username,
        timestamp: context.message.createdTimestamp
      };

      // Track the decision for analytics
      this.decisionTracker.trackDecision(decision, context);

      return decision;
    } catch (error) {
      logger.error('Decision making failed', {
        source: 'llm',
        error: error.message,
        messageId: context.message.id
      });
      return this.getDefaultDecision();
    }
  }

  /**
   * Ensure we have recent conversation history for context-aware decisions
   */
  async ensureConversationHistory(context) {
    try {
      const { conversationHistory = [], conversationManager } = context;
      const channelId = context.message.channel.id;

      // If we have sufficient recent history, no need to load
      if (conversationHistory.length >= 3) {
        return;
      }

      // Initialize history loader if not exists
      if (!this.historyLoader) {
        // Get the Discord client - handle both wrapped and raw clients
        const discordClient = context.message.client.getClient ? 
          context.message.client : 
          context.message.client;
        
        this.historyLoader = new ConversationHistoryLoader(discordClient);
      }

      // Check if we should load history
      const shouldLoad = await this.historyLoader.shouldLoadHistory(channelId, conversationManager);
      
      if (shouldLoad) {
        logger.info('Loading recent conversation history for decision context', {
          source: 'llm',
          channelId: channelId,
          channelName: context.message.channel.name,
          currentHistoryLength: conversationHistory.length
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
        stack: error.stack, // Add stack trace for better debugging
        channelId: context.message?.channel?.id
      });
      // Don't fail the decision process if history loading fails
    }
  }

  // ... rest of your methods remain the same
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
    return this.decisionTracker.getDecisionStats();
  }

  getDecisionHistory(limit = 10) {
    return this.decisionTracker.getDecisionHistory(limit);
  }
}

module.exports = MultiLLMDecisionEngine;