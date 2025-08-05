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
    
    // Use separate decision model settings if available, otherwise fallback to main settings
    return {
      provider: llmSettings.decision_provider || llmSettings.provider || 'featherless',
      model: llmSettings.decision_model || llmSettings.model || 'zai-org/GLM-4-9B-0414',
      api_key: llmSettings.decision_api_key || llmSettings.api_key,
      temperature: llmSettings.decision_temperature !== undefined ? parseFloat(llmSettings.decision_temperature) : 0.3,
      max_tokens: llmSettings.decision_max_tokens ? parseInt(llmSettings.decision_max_tokens) : 200,
      top_p: 0.9
    };
  }

  getConversationSettings() {
    // Get settings for conversation/response generation
    const settings = storage.getSettings();
    const llmSettings = settings.llm || {};
    
    return {
      provider: llmSettings.conversation_provider || llmSettings.provider || 'featherless',
      model: llmSettings.conversation_model || llmSettings.model || 'moonshotai/Kimi-K2-Instruct',
      api_key: llmSettings.conversation_api_key || llmSettings.api_key,
      temperature: llmSettings.conversation_temperature !== undefined ? parseFloat(llmSettings.conversation_temperature) : 0.7,
      max_tokens: llmSettings.conversation_max_tokens ? parseInt(llmSettings.conversation_max_tokens) : 2000,
      top_p: llmSettings.top_p || 1
    };
  }

  async makeQuickDecision(message, channelContext) {
    try {
      const prompt = this.promptBuilder.buildQuickDecisionPrompt(message, channelContext);
      const decisionSettings = this.getDecisionSettings();
      
      logger.debug('Making decision with dedicated model', {
        source: 'llm',
        task: 'decision',
        provider: decisionSettings.provider,
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        maxTokens: decisionSettings.max_tokens,
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
        task: 'decision',
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
      
      // Channel analysis uses decision model but with slightly different settings
      const analysisSettings = {
        ...decisionSettings,
        temperature: 0.4,
        max_tokens: 150
      };
      
      logger.debug('Analyzing channel activity', {
        source: 'llm',
        task: 'channel_analysis',
        model: analysisSettings.model,
        temperature: analysisSettings.temperature
      });
      
      const result = await this.llmService.generateCustomResponse(prompt, analysisSettings);

      return result;
    } catch (error) {
      logger.error('Channel analysis failed', {
        source: 'llm',
        task: 'channel_analysis',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async makeAggressiveDecision(message, channelContext) {
    // More aggressive decision making - lower threshold for responses
    const prompt = this.promptBuilder.buildAggressiveDecisionPrompt(message, channelContext);
    const decisionSettings = this.getDecisionSettings();
    
    // Aggressive settings with decision model
    const aggressiveSettings = {
      ...decisionSettings,
      temperature: 0.4,
      max_tokens: 250,
      top_p: 0.95
    };
    
    logger.debug('Making aggressive decision', {
      source: 'llm',
      task: 'aggressive_decision',
      model: aggressiveSettings.model,
      temperature: aggressiveSettings.temperature
    });
    
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
    
    // Image-focused settings with decision model
    const imageSettings = {
      ...decisionSettings,
      temperature: 0.3,
      max_tokens: 300, // More tokens for image context
      top_p: 0.9
    };
    
    logger.debug('Making image-focused decision', {
      source: 'llm',
      task: 'image_decision',
      model: imageSettings.model,
      hasImages: !!channelContext.hasImages
    });
    
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
    const decisionSettings = this.getDecisionSettings();
    
    logger.debug('Making batch decisions', {
      source: 'llm',
      task: 'batch_decision',
      messageCount: messages.length,
      model: decisionSettings.model
    });
    
    for (const message of messages) {
      try {
        const decision = await this.makeQuickDecision(message, context);
        decisions.push(decision);
      } catch (error) {
        logger.error('Batch decision failed for message', {
          source: 'llm',
          task: 'batch_decision',
          messageId: message.id,
          error: error.message
        });
        decisions.push(this.getDefaultDecision());
      }
    }
    
    return decisions;
  }

  // Get settings info for debugging
  getModelInfo() {
    const decisionSettings = this.getDecisionSettings();
    const conversationSettings = this.getConversationSettings();
    
    return {
      decision: {
        provider: decisionSettings.provider,
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        maxTokens: decisionSettings.max_tokens,
        hasApiKey: !!decisionSettings.api_key
      },
      conversation: {
        provider: conversationSettings.provider,
        model: conversationSettings.model,
        temperature: conversationSettings.temperature,
        maxTokens: conversationSettings.max_tokens,
        hasApiKey: !!conversationSettings.api_key
      }
    };
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