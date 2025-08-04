const DecisionMaker = require('./decision/DecisionMaker');
const ContextAnalyzer = require('./decision/ContextAnalyzer');
const DecisionParser = require('./decision/DecisionParser');
const DecisionTracker = require('./decision/DecisionTracker');
const logger = require('../logger/Logger');

class MultiLLMDecisionEngine {
  constructor() {
    this.contextAnalyzer = new ContextAnalyzer();
    this.decisionMaker = new DecisionMaker();
    this.decisionParser = new DecisionParser();
    this.decisionTracker = new DecisionTracker();

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
   * Analyze if bot should proactively engage with channel
   */
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