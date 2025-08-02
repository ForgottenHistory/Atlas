const ResponseFormatter = require('./ResponseFormatter');
const logger = require('../logger/Logger');

class LLMResponseManager {
  constructor() {
    this.responseFormatter = new ResponseFormatter();
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
      
      // Format and clean the response with character limits
      const originalLength = rawResponse.length;
      const formattedResponse = this.responseFormatter.formatCharacterResponse(
        rawResponse, 
        context.characterName,
        maxCharacters
      );
      
      // Get truncation information
      const truncationInfo = this.responseFormatter.getTruncationInfo(
        originalLength, 
        formattedResponse.length, 
        maxCharacters
      );
      
      // Validate the final response
      const responseValidation = this.responseFormatter.validateResponse(formattedResponse, maxCharacters);
      
      // Log any issues
      this._logResponseIssues(responseValidation, truncationInfo, context.characterName);
      
      return {
        success: true,
        response: formattedResponse,
        metadata: {
          promptLength: context.prompt?.length || 0,
          originalResponse: rawResponse,
          responseTime: responseTime,
          provider: 'current', // Will be filled by caller
          validation: responseValidation,
          tokenUsage: tokenUsage,
          truncationInfo: truncationInfo,
          characterLimit: maxCharacters,
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
      
      // Validate response
      const validation = this.responseFormatter.validateResponse(
        finalResponse, 
        settings.max_characters || 2000
      );
      
      return { 
        success: true, 
        response: finalResponse,
        metadata: {
          responseTime: responseTime,
          truncationInfo: truncationInfo,
          originalLength: rawResponse.length,
          validation: validation,
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

  _logResponseIssues(responseValidation, truncationInfo, characterName) {
    if (!responseValidation.isValid) {
      logger.warn('Response validation issues', {
        source: 'llm',
        issues: responseValidation.issues,
        responseLength: responseValidation.characterCount,
        characterLimit: responseValidation.characterLimit,
        character: characterName
      });
    }
    
    if (truncationInfo.wasTruncated) {
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

  // Response analysis methods
  analyzeResponse(response, metadata = {}) {
    const analysis = {
      length: response.length,
      wordCount: this._countWords(response),
      sentenceCount: this._countSentences(response),
      qualityScore: this._calculateQualityScore(response, metadata),
      issues: this._identifyIssues(response),
      suggestions: this._generateSuggestions(response, metadata)
    };
    
    return analysis;
  }

  _countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  _countSentences(text) {
    return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
  }

  _calculateQualityScore(response, metadata) {
    let score = 100;
    
    // Length penalties
    if (response.length < 20) score -= 30;
    if (response.length > 1500) score -= 10;
    
    // Truncation penalty
    if (metadata.truncationInfo?.wasTruncated) {
      score -= metadata.truncationInfo.truncationPercentage * 0.5;
    }
    
    // Formatting issues
    if (response.includes('*')) score -= 15;
    if (response.match(/^[A-Za-z\s]*:/)) score -= 20;
    
    // Bonus for good characteristics
    const wordCount = this._countWords(response);
    if (wordCount >= 10 && wordCount <= 200) score += 10;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _identifyIssues(response) {
    const issues = [];
    
    if (response.length < 10) {
      issues.push('Response is very short');
    }
    
    if (response.includes('*')) {
      issues.push('Contains asterisk actions');
    }
    
    if (response.match(/^[A-Za-z\s]*:/)) {
      issues.push('Starts with character name prefix');
    }
    
    if (response.includes('```')) {
      issues.push('Contains code blocks');
    }
    
    if (response.length > 2000) {
      issues.push('Exceeds Discord character limit');
    }
    
    return issues;
  }

  _generateSuggestions(response, metadata) {
    const suggestions = [];
    
    if (response.length < 30) {
      suggestions.push('Consider increasing response length for more engaging conversation');
    }
    
    if (metadata.truncationInfo?.wasTruncated) {
      suggestions.push('Reduce max_characters setting or increase context efficiency to avoid truncation');
    }
    
    if (response.includes('*')) {
      suggestions.push('Review system prompt to prevent action descriptions in responses');
    }
    
    const wordCount = this._countWords(response);
    if (wordCount > 300) {
      suggestions.push('Response is very long - consider reducing max_characters for faster reading');
    }
    
    return suggestions;
  }

  // Utility methods for external use
  validateResponse(response, maxCharacters) {
    return this.responseFormatter.validateResponse(response, maxCharacters);
  }

  getTruncationInfo(originalLength, finalLength, maxCharacters) {
    return this.responseFormatter.getTruncationInfo(originalLength, finalLength, maxCharacters);
  }

  formatCharacterResponse(rawResponse, characterName, maxCharacters) {
    return this.responseFormatter.formatCharacterResponse(rawResponse, characterName, maxCharacters);
  }

  limitCharacters(text, maxCharacters) {
    return this.responseFormatter.limitCharacters(text, maxCharacters);
  }

  // Response comparison and improvement
  compareResponses(responses) {
    return responses.map(response => ({
      response: response.text,
      analysis: this.analyzeResponse(response.text, response.metadata),
      ranking: this._rankResponse(response.text, response.metadata)
    })).sort((a, b) => b.ranking - a.ranking);
  }

  _rankResponse(response, metadata) {
    const analysis = this.analyzeResponse(response, metadata);
    let ranking = analysis.qualityScore;
    
    // Adjust ranking based on specific criteria
    ranking += Math.min(10, analysis.wordCount / 10); // Bonus for reasonable length
    ranking -= analysis.issues.length * 5; // Penalty for issues
    
    return Math.max(0, Math.min(100, ranking));
  }
}

module.exports = LLMResponseManager;