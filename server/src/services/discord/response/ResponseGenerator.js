const ResponseContextBuilder = require('./ResponseContextBuilder');
const ResponseProcessor = require('./ResponseProcessor');
const ResponseValidator = require('./ResponseValidator');
const ResponseStatsCollector = require('./ResponseStatsCollector');
const logger = require('../../logger/Logger');
const LLMServiceSingleton = require('../../llm/LLMServiceSingleton');

class ResponseGenerator {
  constructor(conversationManager) {
    this.llmService = LLMServiceSingleton.getInstance();
    this.conversationManager = conversationManager;
    
    // Initialize focused services
    this.contextBuilder = new ResponseContextBuilder();
    this.processor = new ResponseProcessor(conversationManager);
    this.validator = new ResponseValidator();
    this.statsCollector = new ResponseStatsCollector();
    
    logger.info('ResponseGenerator initialized with modular services', { 
      source: 'discord',
      features: ['ContextBuilder', 'Processor', 'Validator', 'StatsCollector'],
      singleton: true
    });
  }

  async generateAndSendResponse(message) {
    try {
      // FIX: Add defensive checks for message structure
      if (!message) {
        logger.error('No message provided to generateAndSendResponse', { source: 'discord' });
        return;
      }

      if (!message.channel) {
        logger.error('Message has no channel', { 
          source: 'discord',
          messageId: message.id || 'unknown'
        });
        return;
      }

      if (!message.author) {
        logger.error('Message has no author', { 
          source: 'discord',
          messageId: message.id || 'unknown',
          channelId: message.channel.id || 'unknown'
        });
        return;
      }

      logger.debug('Processing message for AI response', {
        source: 'discord',
        author: message.author.username || 'Unknown',
        channel: message.channel.name || 'Unknown',
        contentLength: message.content?.length || 0,
        isBatchedMessage: !!message.originalMessages
      });

      // Build context for AI generation
      const context = this.contextBuilder.buildContext(message, this.conversationManager);
      
      // FIX: Add context validation
      if (!context) {
        logger.error('Failed to build context', {
          source: 'discord',
          author: message.author.username || 'Unknown'
        });
        return;
      }
      
      // Validate context before processing
      const validation = this.validator.validateResponseContext(context);
      if (!validation.isValid) {
        logger.warn('Response context validation failed', {
          source: 'discord',
          issues: validation.issues,
          channel: message.channel.name || 'Unknown'
        });
      }
      
      // Generate response using LLM service
      const result = await this.llmService.generateCharacterResponse(context);

      if (result.success) {
        return await this.processor.handleSuccessfulResponse(message, result, context);
      } else {
        return await this.processor.handleFailedResponse(message, result);
      }
      
    } catch (error) {
      logger.error('Error in AI response generation', {
        source: 'llm',
        error: error.message,
        stack: error.stack,
        channel: message?.channel?.name || 'Unknown',
        author: message?.author?.username || 'Unknown',
        messageStructure: {
          hasChannel: !!message?.channel,
          hasAuthor: !!message?.author,
          hasContent: !!message?.content,
          isOriginalMessage: !message?.originalMessages,
          isBatchedMessage: !!message?.originalMessages
        }
      });
      
      return await this.processor.sendFallbackResponse(message);
    }
  }

  // Method to generate responses without sending (for testing/preview)
  async generateResponsePreview(message) {
    try {
      const context = this.contextBuilder.buildContext(message, this.conversationManager);
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
    return this.statsCollector.getResponseStats(channelId, this.conversationManager, this.llmService);
  }

  // Method to validate response context before generation
  validateResponseContext(context) {
    return this.validator.validateResponseContext(context);
  }

  // Get queue-specific statistics
  getQueueStats() {
    return this.llmService.getQueueStats();
  }

  getQueueHealth() {
    return this.llmService.getQueueHealth();
  }
}

module.exports = ResponseGenerator;