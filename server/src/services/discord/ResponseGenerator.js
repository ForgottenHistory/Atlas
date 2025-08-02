const storage = require('../../utils/storage');
const logger = require('../logger/Logger');

class ResponseGenerator {
  constructor(llmService, conversationManager) {
    this.llmService = llmService;
    this.conversationManager = conversationManager;
    
    logger.info('ResponseGenerator initialized', { 
      source: 'discord',
      features: ['AI response generation', 'conversation context', 'token management']
    });
  }

  async generateAndSendResponse(message) {
    try {
      logger.debug('Processing message for AI response', {
        source: 'discord',
        author: message.author.username,
        channel: message.channel.name,
        contentLength: message.content.length
      });

      // Prepare context for AI generation
      const context = await this.buildResponseContext(message);
      
      // Generate response using LLM service
      logger.info('Generating AI response', {
        source: 'llm',
        character: context.characterName || 'Unknown',
        totalHistoryLength: context.conversationHistory.length,
        channel: message.channel.name,
        contextLimit: context.llmSettings.context_limit || 4096,
        maxCharacters: context.llmSettings.max_characters || 2000
      });

      const result = await this.llmService.generateCharacterResponse(context);

      if (result.success) {
        await this.handleSuccessfulResponse(message, result, context);
      } else {
        await this.handleFailedResponse(message, result);
      }
      
    } catch (error) {
      logger.error('Error in AI response generation', {
        source: 'llm',
        error: error.message,
        stack: error.stack,
        channel: message.channel.name,
        author: message.author.username
      });
      
      await this.sendFallbackResponse(message);
    }
  }

  async buildResponseContext(message) {
    const settings = storage.getSettings();
    const persona = storage.getPersona();
    const llmSettings = storage.getLLMSettings();
    const conversationHistory = this.conversationManager.getHistory(message.channel.id);

    return {
      systemPrompt: llmSettings.systemPrompt || settings.systemPrompt,
      characterName: persona.name,
      characterDescription: persona.description,
      exampleMessages: persona.mes_example,
      conversationHistory: conversationHistory,
      llmSettings: llmSettings
    };
  }

  async handleSuccessfulResponse(message, result, context) {
    // Log detailed token usage
    if (result.metadata?.tokenUsage) {
      logger.info('Token usage details', {
        source: 'llm',
        tokenUsage: result.metadata.tokenUsage,
        messagesIncluded: result.metadata.tokenUsage.messagesIncluded || 0,
        totalAvailable: context.conversationHistory.length,
        channel: message.channel.name,
        efficiency: `${result.metadata.tokenUsage.messagesIncluded}/${context.conversationHistory.length} messages used`
      });
    }

    // Log truncation warnings
    if (result.metadata?.truncationInfo?.wasTruncated) {
      logger.warn('Response was truncated', {
        source: 'llm',
        truncationInfo: result.metadata.truncationInfo,
        channel: message.channel.name,
        originalLength: result.metadata.truncationInfo.originalLength,
        finalLength: result.metadata.truncationInfo.finalLength,
        truncationPercentage: result.metadata.truncationInfo.truncationPercentage
      });
    }

    // Send the response
    const response = await message.reply(result.response);
    
    logger.success('AI response sent successfully', {
      source: 'llm',
      character: context.characterName || 'Bot',
      responseLength: result.response.length,
      channel: message.channel.name,
      tokenUsage: result.metadata?.tokenUsage,
      wasTruncated: result.metadata?.truncationInfo?.wasTruncated || false
    });
    
    // Add bot response to conversation history
    this.conversationManager.addMessage(response, true);
    
    // Log activity with detailed context info
    const activityMessage = this.buildActivityMessage(message, result, context);
    await storage.addActivity(activityMessage);

    return response;
  }

  async handleFailedResponse(message, result) {
    logger.error('LLM generation failed', {
      source: 'llm',
      error: result.error,
      channel: message.channel.name,
      fallbackUsed: !!result.fallbackResponse
    });
    
    // Use fallback response
    const fallback = result.fallbackResponse || 'Hi! 👋';
    await message.reply(fallback);
    
    await storage.addActivity(`Fallback response used in #${message.channel.name} (LLM error: ${result.error})`);
  }

  async sendFallbackResponse(message) {
    try {
      await message.reply('Hi! 👋');
      await storage.addActivity(`Emergency fallback response used in #${message.channel.name}`);
    } catch (error) {
      logger.error('Failed to send fallback response', {
        source: 'discord',
        error: error.message,
        channel: message.channel.name
      });
    }
  }

  buildActivityMessage(message, result, context) {
    const parts = [`AI response generated in #${message.channel.name}`];
    
    if (result.metadata?.tokenUsage) {
      const { messagesIncluded } = result.metadata.tokenUsage;
      const totalMessages = context.conversationHistory.length;
      parts.push(`(${messagesIncluded}/${totalMessages} messages in context)`);
    }
    
    if (result.metadata?.truncationInfo?.wasTruncated) {
      const { truncationPercentage } = result.metadata.truncationInfo;
      parts.push(`[truncated ${truncationPercentage}%]`);
    }
    
    return parts.join(' ');
  }

  // Method to generate responses without sending (for testing/preview)
  async generateResponsePreview(message) {
    try {
      const context = await this.buildResponseContext(message);
      const result = await this.llmService.generateCharacterResponse(context);
      
      return {
        success: result.success,
        response: result.response,
        metadata: result.metadata,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Method to get response statistics
  getResponseStats(channelId) {
    const memoryStats = this.conversationManager.getMemoryStats(channelId);
    const llmSettings = storage.getLLMSettings();
    
    return {
      memoryStats,
      responseSettings: {
        maxCharacters: llmSettings.max_characters || 2000,
        contextLimit: llmSettings.context_limit || 4096,
        model: llmSettings.model || 'default',
        temperature: llmSettings.temperature || 0.6
      },
      estimatedResponseTime: this.estimateResponseTime(memoryStats)
    };
  }

  estimateResponseTime(memoryStats) {
    // Rough estimation based on token count
    // More tokens = longer processing time
    const baseTime = 1000; // 1 second base
    const tokenMultiplier = memoryStats.estimatedTokens * 0.1; // 0.1ms per token
    
    return Math.round(baseTime + tokenMultiplier);
  }

  // Method to validate response context before generation
  validateResponseContext(context) {
    const issues = [];
    
    if (!context.characterName) {
      issues.push('No character name defined');
    }
    
    if (!context.characterDescription) {
      issues.push('No character description defined');
    }
    
    if (!context.llmSettings.model) {
      issues.push('No LLM model selected');
    }
    
    if (context.conversationHistory.length === 0) {
      issues.push('No conversation history available');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations: this.getContextRecommendations(context, issues)
    };
  }

  getContextRecommendations(context, issues) {
    const recommendations = [];
    
    if (issues.includes('No character name defined')) {
      recommendations.push('Set a character name in the Persona settings');
    }
    
    if (issues.includes('No character description defined')) {
      recommendations.push('Add a character description in the Persona settings');
    }
    
    if (issues.includes('No LLM model selected')) {
      recommendations.push('Choose an LLM model in the Settings');
    }
    
    if (context.llmSettings.context_limit < 1024) {
      recommendations.push('Consider increasing context limit for better conversation memory');
    }
    
    return recommendations;
  }
}

module.exports = ResponseGenerator;