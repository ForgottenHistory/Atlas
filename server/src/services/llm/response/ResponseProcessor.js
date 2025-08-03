const ResponseFormatter = require('../ResponseFormatter');

class ResponseProcessor {
  constructor() {
    this.responseFormatter = new ResponseFormatter();
  }

  processCharacterResponse(rawResponse, characterName, maxCharacters) {
    // Format and clean the response with character limits
    const originalLength = rawResponse.length;
    const formattedResponse = this.responseFormatter.formatCharacterResponse(
      rawResponse, 
      characterName,
      maxCharacters
    );
    
    // Get truncation information
    const truncationInfo = this.responseFormatter.getTruncationInfo(
      originalLength, 
      formattedResponse.length, 
      maxCharacters
    );
    
    return {
      response: formattedResponse,
      truncationInfo: truncationInfo,
      originalLength: originalLength
    };
  }

  processCustomResponse(rawResponse, maxCharacters) {
    let finalResponse = rawResponse;
    let truncationInfo = null;
    
    if (maxCharacters) {
      const originalLength = rawResponse.length;
      finalResponse = this.responseFormatter.limitCharacters(rawResponse, maxCharacters);
      truncationInfo = this.responseFormatter.getTruncationInfo(
        originalLength, 
        finalResponse.length, 
        maxCharacters
      );
    }
    
    return {
      response: finalResponse,
      truncationInfo: truncationInfo,
      originalLength: rawResponse.length
    };
  }

  getTruncationInfo(originalLength, finalLength, maxCharacters) {
    return this.responseFormatter.getTruncationInfo(originalLength, finalLength, maxCharacters);
  }

  limitCharacters(text, maxCharacters) {
    return this.responseFormatter.limitCharacters(text, maxCharacters);
  }

  // Advanced processing methods
  processWithOptions(rawResponse, options = {}) {
    const {
      characterName = null,
      maxCharacters = 2000,
      removeFormatting = true,
      truncateAtSentence = true,
      preserveEmojis = true
    } = options;

    let processed = rawResponse;

    // Apply character-specific formatting if provided
    if (characterName) {
      processed = this.responseFormatter.formatCharacterResponse(
        processed, 
        characterName, 
        maxCharacters
      );
    } else {
      // Apply general formatting
      if (removeFormatting) {
        processed = this.responseFormatter.removeMarkdownFormatting(processed);
        processed = this.responseFormatter.cleanLLMArtifacts(processed);
      }
      
      if (maxCharacters) {
        processed = this.responseFormatter.limitCharacters(processed, maxCharacters);
      }
      
      processed = this.responseFormatter.finalCleanup(processed);
    }

    const truncationInfo = this.responseFormatter.getTruncationInfo(
      rawResponse.length,
      processed.length,
      maxCharacters
    );

    return {
      response: processed,
      truncationInfo: truncationInfo,
      processingOptions: options
    };
  }

  batchProcessResponses(responses, options = {}) {
    return responses.map((response, index) => {
      try {
        const processed = this.processWithOptions(response.rawResponse || response, {
          ...options,
          characterName: response.characterName || options.characterName
        });
        
        return {
          index: index,
          success: true,
          ...processed
        };
      } catch (error) {
        return {
          index: index,
          success: false,
          error: error.message,
          response: response.rawResponse || response
        };
      }
    });
  }

  // Specialized processing for different response types
  processChatResponse(rawResponse, maxCharacters = 2000) {
    // Optimized for chat/conversation responses
    let processed = rawResponse.trim();
    
    // Remove common chat artifacts
    processed = processed.replace(/^(Assistant|AI|Bot):\s*/i, '');
    processed = processed.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
    
    // Apply character limit
    if (maxCharacters) {
      processed = this.responseFormatter.limitCharacters(processed, maxCharacters);
    }
    
    return processed;
  }

  processCommandResponse(rawResponse, maxCharacters = 1000) {
    // Optimized for command responses (shorter, more direct)
    let processed = rawResponse.trim();
    
    // Remove verbose explanations for commands
    processed = processed.split('\n')[0]; // Take first line only
    processed = processed.replace(/^(Here's|This is|The answer is)\s*/i, '');
    
    // Apply stricter character limit for commands
    if (maxCharacters) {
      processed = this.responseFormatter.limitCharacters(processed, maxCharacters);
    }
    
    return processed;
  }

  processNarrativeResponse(rawResponse, maxCharacters = 3000) {
    // Optimized for longer narrative responses
    let processed = rawResponse.trim();
    
    // Preserve paragraph structure for narratives
    processed = processed.replace(/\n\s*\n/g, '\n\n'); // Normalize paragraph breaks
    
    // Apply larger character limit for narratives
    if (maxCharacters) {
      processed = this.limitCharactersPreservingStructure(processed, maxCharacters);
    }
    
    return processed;
  }

  limitCharactersPreservingStructure(text, maxCharacters) {
    if (text.length <= maxCharacters) return text;
    
    // Try to cut at paragraph boundary
    const paragraphs = text.split('\n\n');
    let result = '';
    
    for (const paragraph of paragraphs) {
      if ((result + paragraph).length > maxCharacters) {
        break;
      }
      result += (result ? '\n\n' : '') + paragraph;
    }
    
    // If we got a reasonable amount, return it
    if (result.length > maxCharacters * 0.7) {
      return result;
    }
    
    // Otherwise, use standard truncation
    return this.responseFormatter.limitCharacters(text, maxCharacters);
  }
}

module.exports = ResponseProcessor;