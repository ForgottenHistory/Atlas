const PromptBuilder = require('./PromptBuilder');
const logger = require('../logger/Logger');

class LLMContextManager {
  constructor() {
    this.promptBuilder = new PromptBuilder();
  }

  buildCharacterPrompt(context) {
    try {
      return this.promptBuilder.buildCharacterPrompt(context);
    } catch (error) {
      logger.error('Error building character prompt', {
        source: 'llm',
        error: error.message,
        character: context.characterName
      });
      throw error;
    }
  }

  validateTokenLimits(context) {
    try {
      return this.promptBuilder.validateTokenLimits(context);
    } catch (error) {
      logger.error('Error validating token limits', {
        source: 'llm',
        error: error.message
      });
      
      return {
        isValid: false,
        usage: { used: 0, available: 0, limit: 0, percentage: 0 },
        recommendations: ['Unable to validate token usage due to error']
      };
    }
  }

  getTokenUsageStats(context) {
    try {
      const validation = this.promptBuilder.validateTokenLimits(context);
      return {
        success: true,
        usage: validation.usage,
        recommendations: validation.recommendations,
        isValid: validation.isValid
      };
    } catch (error) {
      logger.error('Failed to get token usage stats', {
        source: 'llm',
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  previewMessageFit(context) {
    try {
      const promptResult = this.promptBuilder.buildCharacterPrompt(context);
      return {
        success: true,
        messagesIncluded: promptResult.metadata.messagesIncluded,
        totalMessages: (context.conversationHistory || []).length,
        tokenUsage: promptResult.metadata
      };
    } catch (error) {
      logger.error('Failed to preview message fit', {
        source: 'llm',
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Advanced context analysis methods
  analyzeContextEfficiency(context) {
    try {
      const promptResult = this.promptBuilder.buildCharacterPrompt(context);
      const { metadata } = promptResult;
      
      const efficiency = {
        tokenEfficiency: (metadata.messagesIncluded / (context.conversationHistory?.length || 1)) * 100,
        contextUtilization: (metadata.totalTokens / metadata.availableTokens) * 100,
        memoryUtilization: (metadata.historyTokens / metadata.totalTokens) * 100,
        baseOverhead: (metadata.baseTokens / metadata.totalTokens) * 100
      };
      
      const recommendations = this._generateEfficiencyRecommendations(efficiency, metadata);
      
      return {
        success: true,
        efficiency,
        recommendations,
        metadata
      };
    } catch (error) {
      logger.error('Failed to analyze context efficiency', {
        source: 'llm',
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  _generateEfficiencyRecommendations(efficiency, metadata) {
    const recommendations = [];
    
    if (efficiency.contextUtilization > 90) {
      recommendations.push('Context is nearly full - consider increasing context limit');
    }
    
    if (efficiency.tokenEfficiency < 50 && metadata.messagesIncluded < 5) {
      recommendations.push('Very few messages fit in context - consider optimizing prompt or increasing limit');
    }
    
    if (efficiency.baseOverhead > 60) {
      recommendations.push('System prompt and character info are using most of the context');
    }
    
    if (efficiency.memoryUtilization < 20 && metadata.messagesIncluded > 0) {
      recommendations.push('Most context is used by system prompt - conversation history is minimal');
    }
    
    return recommendations;
  }

  // Context optimization methods
  optimizeContext(context, targetTokens) {
    try {
      // Create optimized version with target token count
      const optimizedContext = { ...context };
      
      // If we need to reduce tokens, try different strategies
      if (targetTokens) {
        optimizedContext.llmSettings = {
          ...context.llmSettings,
          context_limit: targetTokens
        };
      }
      
      const promptResult = this.promptBuilder.buildCharacterPrompt(optimizedContext);
      
      return {
        success: true,
        optimizedContext,
        tokenUsage: promptResult.metadata,
        savings: context.llmSettings?.context_limit 
          ? (context.llmSettings.context_limit - promptResult.metadata.totalTokens)
          : 0
      };
    } catch (error) {
      logger.error('Failed to optimize context', {
        source: 'llm',
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Context validation methods
  validateContextStructure(context) {
    const issues = [];
    const warnings = [];
    
    if (!context) {
      issues.push('Context is null or undefined');
      return { isValid: false, issues, warnings };
    }
    
    // Required fields
    if (!context.characterName) {
      warnings.push('No character name provided');
    }
    
    if (!context.characterDescription) {
      warnings.push('No character description provided');
    }
    
    if (!context.llmSettings) {
      issues.push('LLM settings are required');
    } else {
      // Validate LLM settings
      if (!context.llmSettings.context_limit || context.llmSettings.context_limit < 512) {
        warnings.push('Context limit is very low or not set');
      }
      
      if (!context.llmSettings.max_characters) {
        warnings.push('Max characters not set');
      }
    }
    
    // Conversation history validation
    if (context.conversationHistory && !Array.isArray(context.conversationHistory)) {
      issues.push('Conversation history must be an array');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  // Debugging and analysis helpers
  getContextSummary(context) {
    try {
      const validation = this.validateContextStructure(context);
      const promptResult = this.promptBuilder.buildCharacterPrompt(context);
      
      return {
        structure: validation,
        tokenUsage: promptResult.metadata,
        characterInfo: {
          name: context.characterName || 'Not set',
          hasDescription: !!context.characterDescription,
          hasExamples: !!(context.exampleMessages && context.exampleMessages.trim())
        },
        conversationInfo: {
          totalMessages: context.conversationHistory?.length || 0,
          messagesInContext: promptResult.metadata.messagesIncluded,
          utilizationRate: `${Math.round((promptResult.metadata.messagesIncluded / (context.conversationHistory?.length || 1)) * 100)}%`
        }
      };
    } catch (error) {
      return {
        error: error.message,
        structure: { isValid: false, issues: [error.message], warnings: [] }
      };
    }
  }
}

module.exports = LLMContextManager;