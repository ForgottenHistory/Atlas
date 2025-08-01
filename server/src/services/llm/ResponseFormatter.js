class ResponseFormatter {
  constructor() {
    this.maxResponseLength = 2000; // Discord message limit
  }

  formatCharacterResponse(rawResponse, characterName) {
    if (!rawResponse) return '';
    
    console.log('Original response:', rawResponse);
    
    let formatted = rawResponse.trim();
    
    // Remove ALL RP actions first (anything between asterisks)
    formatted = this.removeRPActions(formatted);
    
    // Remove character name prefixes and dialogue formatting
    formatted = this.removeCharacterFormatting(formatted, characterName);
    
    // Remove ALL markdown formatting for plain text
    formatted = this.removeMarkdownFormatting(formatted);
    
    // Clean up common LLM artifacts
    formatted = this.cleanLLMArtifacts(formatted);
    
    // Ensure reasonable length
    formatted = this.truncateIfNeeded(formatted);
    
    // Final cleanup
    formatted = this.finalCleanup(formatted);
    
    console.log('Formatted response:', formatted);
    
    return formatted;
  }

  removeRPActions(text) {
    // Remove action descriptions in asterisks
    let cleaned = text.replace(/\*[^*]*?\*/g, '');
    
    // Remove any remaining standalone asterisks
    cleaned = cleaned.replace(/\*/g, '');
    
    console.log('After removing RP actions:', cleaned);
    return cleaned;
  }

  removeCharacterFormatting(text, characterName) {
    let cleaned = text;
    
    // Remove lines that start with ">" (quote indicators common in RP)
    cleaned = cleaned.replace(/^>\s*/gm, '');
    
    if (characterName) {
      const namePattern = this.escapeRegex(characterName);
      
      // Comprehensive patterns for character name removal
      const patterns = [
        // Character name with emotion: "Viper (playfully):"
        new RegExp(`^\\s*${namePattern}\\s*\\([^)]*\\)\\s*:\\s*`, 'gmi'),
        
        // Simple character name: "Viper:"
        new RegExp(`^\\s*${namePattern}\\s*:\\s*`, 'gmi'),
        
        // With quotes: 'Viper (playfully): "'
        new RegExp(`^\\s*${namePattern}\\s*\\([^)]*\\)\\s*:\\s*["']`, 'gmi'),
        new RegExp(`^\\s*${namePattern}\\s*:\\s*["']`, 'gmi'),
      ];
      
      for (const pattern of patterns) {
        const before = cleaned;
        cleaned = cleaned.replace(pattern, '');
        if (before !== cleaned) {
          console.log(`Character pattern matched and removed`);
        }
      }
    }
    
    // Generic patterns for any character name format
    const genericPatterns = [
      // Any name with emotion in parentheses
      /^[A-Za-z\s]+\s*\([^)]*\)\s*:\s*/gmi,
      
      // Any single word followed by colon (likely a character name)
      /^[A-Za-z]+\s*:\s*/gmi
    ];
    
    for (const pattern of genericPatterns) {
      const before = cleaned;
      cleaned = cleaned.replace(pattern, '');
      if (before !== cleaned) {
        console.log(`Generic character pattern matched and removed`);
      }
    }
    
    console.log('After removing character formatting:', cleaned);
    return cleaned;
  }

  removeMarkdownFormatting(text) {
    return text
      // Remove bold **text**
      .replace(/\*\*(.*?)\*\*/g, '$1')
      
      // Remove italic *text*
      .replace(/\*(.*?)\*/g, '$1')
      
      // Remove italic _text_
      .replace(/_(.*?)_/g, '$1')
      
      // Remove strikethrough ~~text~~
      .replace(/~~(.*?)~~/g, '$1')
      
      // Remove code `text`
      .replace(/`(.*?)`/g, '$1')
      
      // Remove any remaining markdown symbols
      .replace(/[*_~`]/g, '');
  }

  cleanLLMArtifacts(text) {
    return text
      // Remove surrounding quotes if entire message is quoted
      .replace(/^["'"](.*?)["'"]$/s, '$1')
      
      // Remove dialogue dashes
      .replace(/^[-–—]\s*/gm, '')
      
      // Remove trailing periods from single word responses
      .replace(/^(\w+)\.$/, '$1')
      
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      
      // Remove multiple line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      
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
      // Remove multiple consecutive spaces
      .replace(/\s+/g, ' ')
      // Remove multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Clean up line breaks
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0) // Remove empty lines
      .join(' ') // Join all into single line for Discord
      .trim();
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

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
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = ResponseFormatter;