const ResponseProcessor = require('./response/ResponseProcessor');
const ResponseAnalyzer = require('./response/ResponseAnalyzer');
const ResponseValidator = require('./response/ResponseValidator');
const logger = require('../logger/Logger');

class LLMResponseManager {
  constructor() {
    this.processor = new ResponseProcessor();
    this.analyzer = new ResponseAnalyzer();
    this.validator = new ResponseValidator();
  }

  processCharacterResponse(rawResponse, responseTime, context, tokenUsage) {
    try {
      const maxCharacters = context.llmSettings?.max_characters || 2000;
      
      logger.debug('Processing character response', {
        source: 'llm',
        rawLength: rawResponse.length,
        maxCharacters: maxCharacters,
        character: context.characterName
      });
      
      // Process and format the response
      const processedResponse = this.processor.processCharacterResponse(
        rawResponse, 
        context.characterName,
        maxCharacters
      );
      
      // Validate the final response
      const validation = this.validator.validateResponse(processedResponse.response, maxCharacters);
      
      // Analyze response quality
      const analysis = this.analyzer.analyzeResponse(processedResponse.response, {
        originalLength: rawResponse.length,
        tokenUsage: tokenUsage,
        context: context
      });
      
      // Log any issues
      this.logResponseIssues(validation, processedResponse.truncationInfo, context.characterName);
      
      return {
        success: true,
        response: processedResponse.response,
        metadata: {
          promptLength: context.prompt?.length || 0,
          originalResponse: rawResponse,
          responseTime: responseTime,
          provider: 'current',
          validation: validation,
          tokenUsage: tokenUsage,
          truncationInfo: processedResponse.truncationInfo,
          characterLimit: maxCharacters,
          analysis: analysis,
          queueProcessed: true
        }
      };
    } catch (error) {
      logger.error('Error processing character response', {
        source: 'llm',
        error: error.message,
        character: context.characterName
      });
      
      return {
        success: false,
        error: error.message,
        fallbackResponse: `*${context.characterName || 'Bot'} seems to be having trouble responding right now.*`
      };
    }
  }

  processCustomResponse(rawResponse, responseTime, settings) {
    try {
      logger.debug('Processing custom response', {
        source: 'llm',
        rawLength: rawResponse.length,
        hasCharacterLimit: !!settings.max_characters
      });

      // Process the response
      const processedResponse = this.processor.processCustomResponse(
        rawResponse,
        settings.max_characters
      );
      
      // Validate response
      const validation = this.validator.validateResponse(
        processedResponse.response, 
        settings.max_characters || 2000
      );
      
      // Analyze response
      const analysis = this.analyzer.analyzeResponse(processedResponse.response, {
        originalLength: rawResponse.length,
        settings: settings
      });
      
      return { 
        success: true, 
        response: processedResponse.response,
        metadata: {
          responseTime: responseTime,
          truncationInfo: processedResponse.truncationInfo,
          originalLength: rawResponse.length,
          validation: validation,
          analysis: analysis,
          queueProcessed: true
        }
      };
    } catch (error) {
      logger.error('Error processing custom response', {
        source: 'llm',
        error: error.message
      });

      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  logResponseIssues(validation, truncationInfo, characterName) {
    if (!validation.isValid) {
      logger.warn('Response validation issues', {
        source: 'llm',
        issues: validation.issues,
        responseLength: validation.characterCount,
        characterLimit: validation.characterLimit,
        character: characterName
      });
    }
    
    if (truncationInfo && truncationInfo.wasTruncated) {
      logger.warn('Response was truncated', {
        source: 'llm',
        originalLength: truncationInfo.originalLength,
        finalLength: truncationInfo.finalLength,
        truncationPercentage: truncationInfo.truncationPercentage,
        characterLimit: truncationInfo.characterLimit,
        character: characterName
      });
    }
  }

  // Public API methods - delegate to appropriate services
  analyzeResponse(response, metadata = {}) {
    return this.analyzer.analyzeResponse(response, metadata);
  }

  validateResponse(response, maxCharacters) {
    return this.validator.validateResponse(response, maxCharacters);
  }

  getTruncationInfo(originalLength, finalLength, maxCharacters) {
    return this.processor.getTruncationInfo(originalLength, finalLength, maxCharacters);
  }

  formatCharacterResponse(rawResponse, characterName, maxCharacters) {
    const processed = this.processor.processCharacterResponse(rawResponse, characterName, maxCharacters);
    return processed.response;
  }

  limitCharacters(text, maxCharacters) {
    return this.processor.limitCharacters(text, maxCharacters);
  }

  compareResponses(responses) {
    return this.analyzer.compareResponses(responses);
  }

  generateResponseReport(response, metadata = {}) {
    const analysis = this.analyzer.analyzeResponse(response, metadata);
    const validation = this.validator.validateResponse(response, metadata.characterLimit);
    
    return {
      response: {
        length: response.length,
        wordCount: analysis.wordCount,
        qualityScore: analysis.qualityScore
      },
      validation: validation,
      analysis: analysis,
      recommendations: analysis.suggestions,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = LLMResponseManager;