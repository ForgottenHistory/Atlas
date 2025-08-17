const logger = require('../logger/Logger');

class LLMContextManager {
  constructor() {
    // Remove legacy PromptBuilder dependency
    // Plugin system handles prompts now
  }

  buildCharacterPrompt(context) {
    try {
      // Simple fallback implementation for legacy compatibility
      return this.createBasicPrompt(context);
    } catch (error) {
      logger.error('Error building character prompt', {
        source: 'llm',
        error: error.message,
        character: context.characterName
      });
      throw error;
    }
  }

  createBasicPrompt(context) {
    const characterName = context.characterName || 'Assistant';
    const characterDescription = context.characterDescription || 'A helpful AI assistant.';
    
    let prompt = `You are ${characterName}.\n\n${characterDescription}\n\n`;
    
    // Add conversation history if available
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      prompt += 'Recent conversation:\n';
      context.conversationHistory.slice(-5).forEach(msg => {
        const author = msg.author?.username || 'User';
        prompt += `${author}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    return {
      prompt,
      metadata: {
        totalTokens: Math.ceil(prompt.length / 4), // Rough token estimate
        messagesIncluded: context.conversationHistory?.length || 0,
        availableTokens: context.llmSettings?.context_limit || 4096,
        baseTokens: Math.ceil((characterName + characterDescription).length / 4)
      }
    };
  }

  validateTokenLimits(context) {
    try {
      const promptResult = this.createBasicPrompt(context);
      const { totalTokens, availableTokens } = promptResult.metadata;
      
      return {
        isValid: totalTokens <= availableTokens,
        usage: {
          used: totalTokens,
          available: availableTokens,
          limit: availableTokens,
          percentage: Math.round((totalTokens / availableTokens) * 100)
        },
        recommendations: totalTokens > availableTokens * 0.9 ? 
          ['Consider reducing conversation history or character description'] : []
      };
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
      const validation = this.validateTokenLimits(context);
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
      const promptResult = this.createBasicPrompt(context);
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
      const promptResult = this.createBasicPrompt(context);
      
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