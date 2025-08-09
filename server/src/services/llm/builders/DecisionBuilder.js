const storage = require('../../../utils/storage');
const TemplateEngine = require('../prompts/TemplateEngine');
const { 
  QUICK_DECISION_TEMPLATE,
  TOOL_ENHANCED_DECISION_TEMPLATE,
  BATCH_DECISION_TEMPLATE,
  CHANNEL_ANALYSIS_TEMPLATE
} = require('../prompts/decisionPrompts');

/**
 * Handles all decision-making prompt generation
 * Focused on helping Atlas decide what action to take
 */
class DecisionBuilder {
  
  /**
   * Build quick decision prompt for simple message processing
   */
  static buildQuickDecision(message, channelContext) {
    const persona = storage.getPersona();
    const variables = {
      ...TemplateEngine.buildContextVariables(message, channelContext, persona),
      conversationContext: TemplateEngine.buildConversationContext(channelContext.conversationHistory),
      imageContext: TemplateEngine.buildImageContext(message, channelContext)
    };

    return TemplateEngine.substitute(QUICK_DECISION_TEMPLATE, variables);
  }

  /**
   * Build tool-enhanced decision prompt with tool results
   */
  static buildToolDecision(message, channelContext, toolResults, previousActions) {
    const persona = storage.getPersona();
    const variables = {
      ...TemplateEngine.buildContextVariables(message, channelContext, persona),
      conversationContext: TemplateEngine.buildConversationContext(channelContext.conversationHistory),
      imageContext: TemplateEngine.buildImageContext(message, channelContext),
      toolResults: TemplateEngine.buildToolResults(toolResults),
      actionHistory: TemplateEngine.buildActionHistory(previousActions)
    };

    return TemplateEngine.substitute(TOOL_ENHANCED_DECISION_TEMPLATE, variables);
  }

  /**
   * Build channel analysis prompt for understanding context
   */
  static buildChannelAnalysis(analysisContext) {
    const persona = storage.getPersona();
    const variables = {
      characterName: persona.name || 'Atlas',
      channelName: analysisContext.channelName || 'unknown',
      serverName: analysisContext.serverName || 'unknown',
      activityLevel: analysisContext.activityLevel || 'normal',
      participantCount: analysisContext.participantCount || 0,
      messagesSummary: analysisContext.messagesSummary || 'No recent messages'
    };

    return TemplateEngine.substitute(CHANNEL_ANALYSIS_TEMPLATE, variables);
  }

  /**
   * Build batch decision prompt for multiple messages
   */
  static buildBatchDecision(messages, context) {
    const persona = storage.getPersona();
    const messageList = messages.map((msg, index) => 
      `${index + 1}. ${msg.author.username}: "${msg.content}"`
    ).join('\n');

    const variables = {
      characterName: persona.name || 'Atlas',
      channelName: context.channelName || 'unknown',
      serverName: context.serverName || 'unknown',
      activityLevel: context.activityLevel || 'normal',
      messageList: messageList
    };

    return TemplateEngine.substitute(BATCH_DECISION_TEMPLATE, variables);
  }

  /**
   * Build decision prompt with plugin tool results
   * Enhanced version that works with the new plugin system
   */
  static buildPluginDecision(message, channelContext, pluginResults = []) {
    const persona = storage.getPersona();
    
    // Convert plugin results to tool results format
    const toolResults = pluginResults.map(result => ({
      tool: result.pluginName || result.toolName || 'unknown',
      summary: result.data || result.summary || 'No result',
      success: result.success || false
    }));

    const variables = {
      ...TemplateEngine.buildContextVariables(message, channelContext, persona),
      conversationContext: TemplateEngine.buildConversationContext(channelContext.conversationHistory),
      imageContext: TemplateEngine.buildImageContext(message, channelContext),
      toolResults: TemplateEngine.buildToolResults(toolResults),
      pluginCount: pluginResults.length
    };

    return TemplateEngine.substitute(TOOL_ENHANCED_DECISION_TEMPLATE, variables);
  }

  /**
   * Validate decision prompt context
   */
  static validateContext(context) {
    const errors = [];

    if (!context.message) {
      errors.push('Message is required');
    }

    if (!context.channelContext) {
      errors.push('Channel context is required');
    }

    if (!context.channelContext.channelName) {
      errors.push('Channel name is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available decision types
   */
  static getDecisionTypes() {
    return [
      'quick',
      'tool_enhanced', 
      'batch',
      'channel_analysis',
      'plugin_enhanced'
    ];
  }

  /**
   * Build decision prompt based on type
   */
  static buildDecisionPrompt(type, options = {}) {
    const { message, channelContext, toolResults, previousActions, messages, analysisContext } = options;

    switch (type) {
      case 'quick':
        return this.buildQuickDecision(message, channelContext);
        
      case 'tool_enhanced':
        return this.buildToolDecision(message, channelContext, toolResults, previousActions);
        
      case 'batch':
        return this.buildBatchDecision(messages, channelContext);
        
      case 'channel_analysis':
        return this.buildChannelAnalysis(analysisContext);
        
      case 'plugin_enhanced':
        return this.buildPluginDecision(message, channelContext, toolResults);
        
      default:
        throw new Error(`Unknown decision type: ${type}`);
    }
  }

  /**
   * Estimate tokens for decision prompt
   */
  static estimateTokens(type, options = {}) {
    try {
      const prompt = this.buildDecisionPrompt(type, options);
      return TemplateEngine.estimateTokenCount(prompt);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get decision prompt metadata
   */
  static getMetadata(type) {
    const metadata = {
      quick: {
        name: 'Quick Decision',
        description: 'Simple decision making for basic messages',
        estimatedTokens: 200,
        requiresTools: false
      },
      tool_enhanced: {
        name: 'Tool Enhanced Decision', 
        description: 'Decision making with tool results',
        estimatedTokens: 400,
        requiresTools: true
      },
      batch: {
        name: 'Batch Decision',
        description: 'Decision making for multiple messages',
        estimatedTokens: 300,
        requiresTools: false
      },
      channel_analysis: {
        name: 'Channel Analysis',
        description: 'Understanding channel context',
        estimatedTokens: 250,
        requiresTools: false
      },
      plugin_enhanced: {
        name: 'Plugin Enhanced Decision',
        description: 'Decision making with plugin results',
        estimatedTokens: 400,
        requiresTools: true
      }
    };

    return metadata[type] || { name: 'Unknown', description: '', estimatedTokens: 0 };
  }
}

module.exports = DecisionBuilder;