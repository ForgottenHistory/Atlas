const LLMServiceSingleton = require('../LLMServiceSingleton');
const PromptBuilder = require('./PromptBuilder');
const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');

class DecisionMaker {
  constructor() {
    this.llmService = LLMServiceSingleton.getInstance();
    this.promptBuilder = new PromptBuilder();
  }

  getDecisionSettings() {
    // Get LLM settings from main settings storage
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};
    
    return {
      provider: llmSettings.provider || 'featherless',
      model: llmSettings.model || 'moonshotai/Kimi-K2-Instruct',
      api_key: llmSettings.api_key,
      temperature: 0.3, // Keep decision-specific temperature
      max_tokens: 200,
      top_p: 0.9
    };
  }

  async makeQuickDecision(message, channelContext) {
    try {
      const prompt = this.promptBuilder.buildQuickDecisionPrompt(message, channelContext);
      const decisionSettings = this.getDecisionSettings();
      
      logger.debug('Making decision with settings', {
        source: 'llm',
        provider: decisionSettings.provider,
        model: decisionSettings.model,
        hasApiKey: !!decisionSettings.api_key
      });
      
      const result = await this.llmService.generateCustomResponse(prompt, decisionSettings);

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
      const decisionSettings = this.getDecisionSettings();
      
      // Channel analysis can use slightly different settings
      const analysisSettings = {
        ...decisionSettings,
        temperature: 0.4,
        max_tokens: 100
      };
      
      const result = await this.llmService.generateCustomResponse(prompt, analysisSettings);

      return result;
    } catch (error) {
      logger.error('Channel analysis failed', {
        source: 'llm',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async makeAggressiveDecision(message, channelContext) {
    // More aggressive decision making - lower threshold for responses
    const prompt = this.promptBuilder.buildAggressiveDecisionPrompt(message, channelContext);
    const decisionSettings = this.getDecisionSettings();
    
    // Aggressive settings
    const aggressiveSettings = {
      ...decisionSettings,
      temperature: 0.4, // Higher temperature for more varied responses
      max_tokens: 200,
      top_p: 0.95
    };
    
    const result = await this.llmService.generateCustomResponse(prompt, aggressiveSettings);

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
    const decisionSettings = this.getDecisionSettings();
    
    // Image-focused settings
    const imageSettings = {
      ...decisionSettings,
      temperature: 0.3,
      max_tokens: 250, // More tokens for image context
      top_p: 0.9
    };
    
    const result = await this.llmService.generateCustomResponse(prompt, imageSettings);

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
        decisions.push(decision);
      } catch (error) {
        logger.error('Batch decision failed for message', {
          source: 'llm',
          messageId: message.id,
          error: error.message
        });
        decisions.push(this.getDefaultDecision());
      }
    }
    
    return decisions;
  }

  // Get the default decision when all else fails
  getDefaultDecision() {
    return {
      action: 'ignore',
      confidence: 0,
      reasoning: 'Default fallback decision'
    };
  }
}

module.exports = DecisionMaker;