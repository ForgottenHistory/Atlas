const LLMClient = require('./LLMClient');
const logger = require('../logger/Logger');

class LLMRequestHandler {
  constructor(requestQueue) {
    this.requestQueue = requestQueue;
    this.llmClient = new LLMClient();

    logger.info('LLM Request Handler initialized', {
      source: 'llm',
      provider: this.llmClient.getCurrentProvider(),
      queueEnabled: true
    });
  }

  async processCharacterRequest(context, contextManager, responseManager) {
    // Queue the character response generation
    return await this.requestQueue.enqueue(
      'character_generation',
      context,
      this._handleCharacterGeneration.bind(this, contextManager, responseManager)
    );
  }

  async processCustomRequest(requestData, responseManager) {
    // Queue the custom response generation
    return await this.requestQueue.enqueue(
      'custom_prompt',
      requestData,
      this._handleCustomGeneration.bind(this, responseManager)
    );
  }

  async _handleCharacterGeneration(contextManager, responseManager, context) {
    try {
      logger.info('Processing character response generation', {
        source: 'llm',
        character: context.characterName,
        hasHistory: (context.conversationHistory || []).length > 0,
        provider: this.llmClient.getCurrentProvider(),
        contextLimit: context.llmSettings?.context_limit || 4096
      });

      // Build the complete prompt with dynamic memory management
      const promptResult = contextManager.buildCharacterPrompt(context);
      const { prompt, metadata: tokenUsage } = promptResult;

      // Log prompt building results
      this._logPromptResults(tokenUsage, context.characterName);

      // NEW: Broadcast prompt data to frontend via socket
      this._broadcastPromptData(prompt, tokenUsage, context);

      // Validate token limits before sending to LLM
      const validation = contextManager.validateTokenLimits(context);
      if (!validation.isValid) {
        logger.warn('Token limit validation failed', {
          source: 'llm',
          usage: validation.usage,
          recommendations: validation.recommendations
        });
      }

      // Generate response using LLM client
      const llmResponse = await this._generateLLMResponse(prompt, context.llmSettings);

      // Process and format the response
      const processedResponse = responseManager.processCharacterResponse(
        llmResponse.rawResponse,
        llmResponse.responseTime,
        context,
        tokenUsage
      );

      logger.success('Character response generated successfully', {
        source: 'llm',
        finalLength: processedResponse.response.length,
        responseTime: `${llmResponse.responseTime}ms`,
        character: context.characterName,
        isValid: processedResponse.metadata.validation.isValid,
        wasTruncated: processedResponse.metadata.truncationInfo.wasTruncated,
        tokenEfficiency: `${tokenUsage.messagesIncluded} messages in ${tokenUsage.totalTokens} tokens`
      });

      return processedResponse;

    } catch (error) {
      return this._handleGenerationError(error, context.characterName);
    }
  }

  _broadcastPromptData(prompt, tokenUsage, context) {
    try {
      const promptData = {
        prompt: prompt,
        tokenUsage: tokenUsage,
        character: context.characterName || 'Unknown',
        timestamp: new Date().toISOString(),
        channel: context.channel?.name || 'Unknown',
        author: context.author?.username || 'Unknown'
      };

      // Store globally for socket requests
      global.lastPromptData = promptData;

      // Emit directly using Node.js events to notify socket system
      process.nextTick(() => {
        process.emit('promptGenerated', promptData);
      });

      logger.debug('Prompt data stored and event emitted', {
        source: 'llm',
        promptLength: prompt.length,
        character: context.characterName,
        totalTokens: tokenUsage.totalTokens
      });

    } catch (error) {
      logger.warn('Failed to broadcast prompt data', {
        source: 'llm',
        error: error.message
      });
    }
  }

  async _handleCustomGeneration(responseManager, { prompt, settings }) {
    try {
      // Log what provider is being used for the custom request
      const currentProvider = settings.provider || this.llmClient.getCurrentProvider();

      logger.info('Processing custom response generation', {
        source: 'llm',
        promptLength: prompt.length,
        provider: currentProvider,
        hasCharacterLimit: !!settings.max_characters,
        settingsProvider: settings.provider,
        hasApiKey: !!settings.api_key
      });

      // Generate response using LLM client with the passed settings
      const llmResponse = await this._generateLLMResponse(prompt, settings);

      // Process the response
      const processedResponse = responseManager.processCustomResponse(
        llmResponse.rawResponse,
        llmResponse.responseTime,
        settings
      );

      logger.success('Custom response generated', {
        source: 'llm',
        responseLength: processedResponse.response.length,
        responseTime: `${llmResponse.responseTime}ms`,
        wasTruncated: processedResponse.metadata.truncationInfo?.wasTruncated || false,
        queueProcessed: true
      });

      return processedResponse;

    } catch (error) {
      return this._handleGenerationError(error, 'custom');
    }
  }

  async _generateLLMResponse(prompt, settings) {
    const startTime = Date.now();
    const rawResponse = await this.llmClient.generateResponse(prompt, settings);
    const responseTime = Date.now() - startTime;

    logger.info('Raw LLM response received', {
      source: 'llm',
      responseTime: `${responseTime}ms`,
      rawResponse: rawResponse,
      rawLength: rawResponse.length,
      provider: this.llmClient.getCurrentProvider()
    });

    return { rawResponse, responseTime };
  }

  _logPromptResults(tokenUsage, characterName) {
    logger.debug('Prompt built with dynamic memory', {
      source: 'llm',
      totalTokens: tokenUsage.totalTokens,
      baseTokens: tokenUsage.baseTokens,
      historyTokens: tokenUsage.historyTokens,
      messagesIncluded: tokenUsage.messagesIncluded,
      contextUsage: `${Math.round((tokenUsage.totalTokens / tokenUsage.availableTokens) * 100)}%`,
      character: characterName
    });
  }

  _handleGenerationError(error, context) {
    logger.error('LLM generation error', {
      source: 'llm',
      error: error.message,
      stack: error.stack,
      context: context,
      provider: this.llmClient.getCurrentProvider()
    });

    return {
      success: false,
      error: error.message,
      fallbackResponse: `*${context || 'Bot'} seems to be having trouble responding right now.*`
    };
  }

  // Provider health and management
  getProviderHealth() {
    return {
      currentProvider: this.llmClient.getCurrentProvider(),
      availableProviders: this.llmClient.getAvailableProviders(),
      providerInfo: this.llmClient.getAllProviderInfo()
    };
  }

  updateProviderConfiguration(config) {
    if (config.provider && this.llmClient.isProviderAvailable(config.provider)) {
      this.llmClient.setProvider(config.provider);
      logger.info('LLM provider updated', {
        source: 'llm',
        newProvider: config.provider
      });
    }
  }

  // Get current provider information
  getCurrentProvider() {
    return this.llmClient.getCurrentProvider();
  }

  getProviderInfo() {
    return this.llmClient.getProviderInfo();
  }
}

module.exports = LLMRequestHandler;