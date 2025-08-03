const LLMServiceSingleton = require('../LLMServiceSingleton');
const PromptBuilder = require('./PromptBuilder');
const logger = require('../../logger/Logger');

class DecisionMaker {
  constructor() {
    this.llmService = LLMServiceSingleton.getInstance();
    this.promptBuilder = new PromptBuilder();
  }

  async makeQuickDecision(message, channelContext) {
    try {
      const prompt = this.promptBuilder.buildQuickDecisionPrompt(message, channelContext);
      
      const result = await this.llmService.generateCustomResponse(prompt, {
        model: 'moonshotai/Kimi-K2-Instruct', // For now, optimize this later
        temperature: 0.3,
        max_tokens: 200, // Increased for image context
        top_p: 0.9
      });

      if (result.success) {
        const DecisionParser = require('./DecisionParser');
        const parser = new DecisionParser();
        return parser.parseDecisionResponse(result.response);
      }

      return this.getDefaultDecision();
    } catch (error) {
      logger.error('Quick decision failed', {
        source: 'llm',
        error: error.message,
        fallback: 'ignore'
      });
      return this.getDefaultDecision();
    }
  }

  async analyzeChannelActivity(analysisContext) {
    try {
      const prompt = this.promptBuilder.buildChannelAnalysisPrompt(analysisContext);
      
      const result = await this.llmService.generateCustomResponse(prompt, {
        temperature: 0.4,
        max_tokens: 100,
        top_p: 0.9
      });

      return result;
    } catch (error) {
      logger.error('Channel activity analysis failed', {
        source: 'llm',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  getDefaultDecision() {
    return {
      action: 'ignore',
      confidence: 0.1,
      reasoning: 'Default fallback decision',
      emoji: null,
      status: null
    };
  }

  // Advanced decision making methods
  async makeContextualDecision(message, context, decisionType = 'standard') {
    const strategies = {
      standard: this.makeQuickDecision.bind(this),
      conservative: this.makeConservativeDecision.bind(this),
      aggressive: this.makeAggressiveDecision.bind(this),
      image_focused: this.makeImageFocusedDecision.bind(this)
    };

    const strategy = strategies[decisionType] || strategies.standard;
    return await strategy(message, context);
  }

  async makeConservativeDecision(message, channelContext) {
    // More conservative decision making - higher threshold for responses
    const prompt = this.promptBuilder.buildConservativeDecisionPrompt(message, channelContext);
    
    const result = await this.llmService.generateCustomResponse(prompt, {
      temperature: 0.2, // Lower temperature for more conservative responses
      max_tokens: 150,
      top_p: 0.8
    });

    if (result.success) {
      const DecisionParser = require('./DecisionParser');
      const parser = new DecisionParser();
      return parser.parseDecisionResponse(result.response);
    }

    return this.getDefaultDecision();
  }

  async makeAggressiveDecision(message, channelContext) {
    // More aggressive decision making - lower threshold for responses
    const prompt = this.promptBuilder.buildAggressiveDecisionPrompt(message, channelContext);
    
    const result = await this.llmService.generateCustomResponse(prompt, {
      temperature: 0.4, // Higher temperature for more varied responses
      max_tokens: 200,
      top_p: 0.95
    });

    if (result.success) {
      const DecisionParser = require('./DecisionParser');
      const parser = new DecisionParser();
      return parser.parseDecisionResponse(result.response);
    }

    return this.getDefaultDecision();
  }

  async makeImageFocusedDecision(message, channelContext) {
    // Decision making specifically optimized for messages with images
    const prompt = this.promptBuilder.buildImageFocusedDecisionPrompt(message, channelContext);
    
    const result = await this.llmService.generateCustomResponse(prompt, {
      temperature: 0.3,
      max_tokens: 250, // More tokens for image context
      top_p: 0.9
    });

    if (result.success) {
      const DecisionParser = require('./DecisionParser');
      const parser = new DecisionParser();
      return parser.parseDecisionResponse(result.response);
    }

    return this.getDefaultDecision();
  }

  // Batch decision making for multiple messages
  async makeBatchDecisions(messages, context) {
    const decisions = [];
    
    for (const message of messages) {
      try {
        const decision = await this.makeQuickDecision(message, context);
        decisions.push({
          messageId: message.id,
          decision,
          timestamp: new Date()
        });
      } catch (error) {
        decisions.push({
          messageId: message.id,
          decision: this.getDefaultDecision(),
          error: error.message,
          timestamp: new Date()
        });
      }
    }
    
    return decisions;
  }

  // Get decision confidence based on context
  calculateDecisionConfidence(message, context) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for clear indicators
    if (context.messageContext.isQuestion) confidence += 0.3;
    if (context.messageContext.mentionsBot) confidence += 0.2;
    if (context.messageContext.hasImages) confidence += 0.1;
    if (context.messageContext.isGreeting) confidence += 0.2;
    
    // Adjust based on activity level
    if (context.activityLevel === 'very_active') confidence -= 0.1;
    if (context.activityLevel === 'quiet') confidence += 0.1;
    
    // Ensure confidence stays within bounds
    return Math.max(0.0, Math.min(1.0, confidence));
  }

  // Validate decision before returning
  validateDecision(decision) {
    const validActions = ['respond', 'reply', 'react', 'ignore', 'status_change'];
    
    if (!decision.action || !validActions.includes(decision.action)) {
      return false;
    }
    
    if (decision.confidence < 0 || decision.confidence > 1) {
      return false;
    }
    
    return true;
  }
}

module.exports = DecisionMaker;