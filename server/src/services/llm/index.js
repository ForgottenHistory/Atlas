const PromptBuilder = require('./PromptBuilder');
const LLMClient = require('./LLMClient');
const ResponseFormatter = require('./ResponseFormatter');
const logger = require('../logger/Logger');

class LLMService {
  constructor() {
    this.promptBuilder = new PromptBuilder();
    this.llmClient = new LLMClient();
    this.responseFormatter = new ResponseFormatter();
    
    logger.info('LLM Service initialized', { 
      source: 'llm',
      provider: this.llmClient.getCurrentProvider()
    });
  }

  async generateCharacterResponse(context) {
    try {
      logger.info('Starting character response generation', {
        source: 'llm',
        character: context.characterName,
        hasHistory: (context.conversationHistory || []).length > 0,
        provider: this.llmClient.getCurrentProvider()
      });

      // Build the complete prompt
      const prompt = this.promptBuilder.buildCharacterPrompt(context);
      
      logger.debug('Prompt built successfully', {
        source: 'llm',
        promptLength: prompt.length,
        estimatedTokens: this.promptBuilder.estimateTokenCount(prompt)
      });
      
      // Get LLM settings
      const llmSettings = context.llmSettings || {};
      
      logger.debug('Using LLM settings', {
        source: 'llm',
        settings: {
          temperature: llmSettings.temperature,
          max_tokens: llmSettings.max_tokens,
          top_p: llmSettings.top_p
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
      
      // Format and clean the response
      const formattedResponse = this.responseFormatter.formatCharacterResponse(
        rawResponse, 
        context.characterName
      );
      
      // Validate the response
      const validation = this.responseFormatter.validateResponse(formattedResponse);
      
      if (!validation.isValid) {
        logger.warn('Response validation issues', {
          source: 'llm',
          issues: validation.issues,
          responseLength: formattedResponse.length
        });
      }
      
      logger.success('Character response generated successfully', {
        source: 'llm',
        finalLength: formattedResponse.length,
        responseTime: `${responseTime}ms`,
        character: context.characterName,
        isValid: validation.isValid
      });
      
      return {
        success: true,
        response: formattedResponse,
        metadata: {
          promptLength: prompt.length,
          originalResponse: rawResponse,
          responseTime: responseTime,
          provider: this.llmClient.getCurrentProvider(),
          validation: validation
        }
      };
    } catch (error) {
      logger.error('LLM Service error', {
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

  // Future method for different contexts
  async generateCustomResponse(prompt, settings = {}) {
    try {
      logger.info('Generating custom response', {
        source: 'llm',
        promptLength: prompt.length,
        provider: this.llmClient.getCurrentProvider()
      });

      const rawResponse = await this.llmClient.generateResponse(prompt, settings);
      
      logger.success('Custom response generated', {
        source: 'llm',
        responseLength: rawResponse.length
      });

      return { success: true, response: rawResponse };
    } catch (error) {
      logger.error('Custom response generation failed', {
        source: 'llm',
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }
}

module.exports = LLMService;