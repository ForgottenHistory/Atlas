const PromptBuilder = require('./PromptBuilder');
const LLMClient = require('./LLMClient');
const ResponseFormatter = require('./ResponseFormatter');
const RequestQueue = require('./RequestQueue');
const logger = require('../logger/Logger');

class LLMService {
  constructor() {
    this.promptBuilder = new PromptBuilder();
    this.llmClient = new LLMClient();
    this.responseFormatter = new ResponseFormatter();
    this.requestQueue = new RequestQueue();
    
    logger.info('LLM Service initialized with request queue', { 
      source: 'llm',
      provider: this.llmClient.getCurrentProvider(),
      queueEnabled: true
    });
  }

  async generateCharacterResponse(context) {
    // Queue the character response generation
    return await this.requestQueue.enqueue(
      'character_generation',
      context,
      this._processCharacterResponse.bind(this)
    );
  }

  async _processCharacterResponse(context) {
    try {
      logger.info('Processing character response generation', {
        source: 'llm',
        character: context.characterName,
        hasHistory: (context.conversationHistory || []).length > 0,
        provider: this.llmClient.getCurrentProvider(),
        contextLimit: context.llmSettings?.context_limit || 4096
      });

      // Build the complete prompt with dynamic memory management
      const promptResult = this.promptBuilder.buildCharacterPrompt(context);
      const { prompt, metadata: tokenUsage } = promptResult;
      
      logger.debug('Prompt built with dynamic memory', {
        source: 'llm',
        totalTokens: tokenUsage.totalTokens,
        baseTokens: tokenUsage.baseTokens,
        historyTokens: tokenUsage.historyTokens,
        messagesIncluded: tokenUsage.messagesIncluded,
        contextUsage: `${Math.round((tokenUsage.totalTokens / tokenUsage.availableTokens) * 100)}%`
      });
      
      // Validate token limits before sending to LLM
      const validation = this.promptBuilder.validateTokenLimits(context);
      if (!validation.isValid) {
        logger.warn('Token limit validation failed', {
          source: 'llm',
          usage: validation.usage,
          recommendations: validation.recommendations
        });
      }
      
      // Get LLM settings with character limits
      const llmSettings = context.llmSettings || {};
      const maxCharacters = llmSettings.max_characters || 2000;
      
      logger.debug('Using LLM settings', {
        source: 'llm',
        settings: {
          temperature: llmSettings.temperature,
          max_tokens: llmSettings.max_tokens,
          top_p: llmSettings.top_p,
          max_characters: maxCharacters
        }
      });
      
      // Send to LLM
      const startTime = Date.now();
      const rawResponse = await this.llmClient.generateResponse(prompt, llmSettings);
      const responseTime = Date.now() - startTime;
      
      logger.info('Raw LLM response received', {
        source: 'llm',
        responseTime: `${responseTime}ms`,
        rawLength: rawResponse.length,
        provider: this.llmClient.getCurrentProvider()
      });
      
      // Format and clean the response with character limits
      const originalLength = rawResponse.length;
      const formattedResponse = this.responseFormatter.formatCharacterResponse(
        rawResponse, 
        context.characterName,
        maxCharacters
      );
      
      // Get truncation info
      const truncationInfo = this.responseFormatter.getTruncationInfo(
        originalLength, 
        formattedResponse.length, 
        maxCharacters
      );
      
      // Validate the final response
      const responseValidation = this.responseFormatter.validateResponse(formattedResponse, maxCharacters);
      
      if (!responseValidation.isValid) {
        logger.warn('Response validation issues', {
          source: 'llm',
          issues: responseValidation.issues,
          responseLength: formattedResponse.length,
          characterLimit: maxCharacters
        });
      }
      
      // Log truncation if it occurred
      if (truncationInfo.wasTruncated) {
        logger.warn('Response was truncated', {
          source: 'llm',
          originalLength: truncationInfo.originalLength,
          finalLength: truncationInfo.finalLength,
          truncationPercentage: truncationInfo.truncationPercentage,
          characterLimit: maxCharacters
        });
      }
      
      logger.success('Character response generated successfully', {
        source: 'llm',
        finalLength: formattedResponse.length,
        responseTime: `${responseTime}ms`,
        character: context.characterName,
        isValid: responseValidation.isValid,
        wasTruncated: truncationInfo.wasTruncated,
        tokenEfficiency: `${tokenUsage.messagesIncluded} messages in ${tokenUsage.totalTokens} tokens`
      });
      
      return {
        success: true,
        response: formattedResponse,
        metadata: {
          promptLength: prompt.length,
          originalResponse: rawResponse,
          responseTime: responseTime,
          provider: this.llmClient.getCurrentProvider(),
          validation: responseValidation,
          tokenUsage: tokenUsage,
          truncationInfo: truncationInfo,
          characterLimit: maxCharacters,
          queueProcessed: true
        }
      };
    } catch (error) {
      logger.error('LLM Service error during character response', {
        source: 'llm',
        error: error.message,
        stack: error.stack,
        character: context.characterName,
        provider: this.llmClient.getCurrentProvider()
      });
      
      return {
        success: false,
        error: error.message,
        fallbackResponse: `*${context.characterName || 'Bot'} seems to be having trouble responding right now.*`
      };
    }
  }

  // Enhanced method for custom responses with token management
  async generateCustomResponse(prompt, settings = {}) {
    // Queue the custom response generation
    return await this.requestQueue.enqueue(
      'custom_prompt',
      { prompt, settings },
      this._processCustomResponse.bind(this)
    );
  }

  async _processCustomResponse({ prompt, settings }) {
    try {
      logger.info('Processing custom response generation', {
        source: 'llm',
        promptLength: prompt.length,
        provider: this.llmClient.getCurrentProvider(),
        hasCharacterLimit: !!settings.max_characters
      });

      const startTime = Date.now();
      const rawResponse = await this.llmClient.generateResponse(prompt, settings);
      const responseTime = Date.now() - startTime;
      
      // Apply character limits if specified
      let finalResponse = rawResponse;
      let truncationInfo = null;
      
      if (settings.max_characters) {
        const originalLength = rawResponse.length;
        finalResponse = this.responseFormatter.limitCharacters(rawResponse, settings.max_characters);
        truncationInfo = this.responseFormatter.getTruncationInfo(
          originalLength, 
          finalResponse.length, 
          settings.max_characters
        );
      }
      
      logger.success('Custom response generated', {
        source: 'llm',
        responseLength: finalResponse.length,
        responseTime: `${responseTime}ms`,
        wasTruncated: truncationInfo?.wasTruncated || false,
        queueProcessed: true
      });

      return { 
        success: true, 
        response: finalResponse,
        metadata: {
          responseTime: responseTime,
          truncationInfo: truncationInfo,
          originalLength: rawResponse.length,
          queueProcessed: true
        }
      };
    } catch (error) {
      logger.error('Custom response generation failed', {
        source: 'llm',
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  // Queue management methods
  getQueueStats() {
    return this.requestQueue.getQueueStats();
  }

  getQueueHealth() {
    return this.requestQueue.isHealthy();
  }

  setQueueConcurrencyLimit(requestType, limit) {
    this.requestQueue.setConcurrencyLimit(requestType, limit);
    
    logger.info('Queue concurrency limit updated via LLM Service', {
      source: 'llm',
      requestType,
      newLimit: limit
    });
  }

  setGlobalConcurrencyLimit(limit) {
    this.requestQueue.setGlobalConcurrencyLimit(limit);
    
    logger.info('Global queue concurrency limit updated via LLM Service', {
      source: 'llm',
      newLimit: limit
    });
  }

  // Method to get token usage statistics
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

  // Method to preview how many messages would fit in context
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
}

module.exports = LLMService;