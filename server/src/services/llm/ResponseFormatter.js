class ResponseFormatter {
  constructor() {
    this.maxResponseLength = 2000; // Discord message limit
  }

  formatCharacterResponse(rawResponse, characterName) {
    if (!rawResponse) return '';
    
    let formatted = rawResponse.trim();
    
    // Remove character name prefix if LLM included it
    formatted = this.removeCharacterPrefix(formatted, characterName);
    
    // Clean up common LLM artifacts
    formatted = this.cleanLLMArtifacts(formatted);
    
    // Ensure reasonable length
    formatted = this.truncateIfNeeded(formatted);
    
    // Final cleanup
    formatted = this.finalCleanup(formatted);
    
    return formatted;
  }

  removeCharacterPrefix(text, characterName) {
    if (!characterName) return text;
    
    // Remove "CharacterName:" prefix if present
    const prefixPattern = new RegExp(`^${this.escapeRegex(characterName)}:\\s*`, 'i');
    return text.replace(prefixPattern, '');
  }

  cleanLLMArtifacts(text) {
    // Remove common LLM artifacts
    return text
      // Remove action indicators like *does something*
      .replace(/^\*.*?\*\s*/g, '')
      
      // Remove quotation marks if the entire response is quoted
      .replace(/^"(.*)"$/s, '$1')
      
      // Remove trailing periods from single word responses
      .replace(/^(\w+)\.$/, '$1')
      
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  truncateIfNeeded(text) {
    if (text.length <= this.maxResponseLength) return text;
    
    // Try to truncate at sentence boundary
    const truncated = text.substring(0, this.maxResponseLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');
    
    const lastPunctuation = Math.max(lastSentence, lastQuestion, lastExclamation);
    
    if (lastPunctuation > this.maxResponseLength * 0.7) {
      return truncated.substring(0, lastPunctuation + 1);
    }
    
    // Fallback: truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > this.maxResponseLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  finalCleanup(text) {
    return text
      .trim()
      // Remove multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Ensure no trailing whitespace on lines
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Utility to check if response seems reasonable
  validateResponse(response) {
    const issues = [];
    
    if (!response || response.trim().length === 0) {
      issues.push('Empty response');
    }
    
    if (response.length < 3) {
      issues.push('Response too short');
    }
    
    if (response.length > this.maxResponseLength * 1.5) {
      issues.push('Response too long');
    }
    
    // Check for repetitive content
    const words = response.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
      issues.push('Response appears repetitive');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = ResponseFormatter;