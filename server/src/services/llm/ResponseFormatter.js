class ResponseFormatter {
  constructor() {
    this.discordMessageLimit = 2000; // Discord's hard limit
    this.defaultMaxCharacters = 2000; // Our default setting
  }

  formatCharacterResponse(rawResponse, characterName, maxCharacters = null) {
    if (!rawResponse) return '';
    
    const characterLimit = maxCharacters || this.defaultMaxCharacters;
    
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
    
    // Apply character limit (with smart truncation)
    formatted = this.limitCharacters(formatted, characterLimit);
    
    // Final cleanup
    formatted = this.finalCleanup(formatted);
    
    console.log('Formatted response:', formatted);
    
    return formatted;
  }

  limitCharacters(text, maxCharacters) {
    if (!text || text.length <= maxCharacters) {
      return text;
    }

    // Ensure we don't exceed Discord's hard limit either
    const effectiveLimit = Math.min(maxCharacters, this.discordMessageLimit);
    
    // Try to truncate at sentence boundary
    const truncated = text.substring(0, effectiveLimit);
    const lastSentence = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    // If we found a sentence ending in the last 30% of the limit, use it
    if (lastSentence > effectiveLimit * 0.7) {
      return truncated.substring(0, lastSentence + 1).trim();
    }
    
    // Otherwise, try to truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > effectiveLimit * 0.8) {
      return truncated.substring(0, lastSpace).trim() + '...';
    }
    
    // Last resort: hard truncate with ellipsis
    return truncated.substring(0, effectiveLimit - 3).trim() + '...';
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

  validateResponse(response, maxCharacters = null) {
    const issues = [];
    const characterLimit = maxCharacters || this.defaultMaxCharacters;
    
    if (!response || response.trim().length === 0) {
      issues.push('Empty response');
    }
    
    if (response.length < 3) {
      issues.push('Response too short');
    }
    
    if (response.length > characterLimit) {
      issues.push(`Response exceeds character limit (${response.length}/${characterLimit})`);
    }
    
    if (response.length > this.discordMessageLimit) {
      issues.push(`Response exceeds Discord limit (${response.length}/${this.discordMessageLimit})`);
    }
    
    // Check for remaining formatting artifacts
    if (response.includes('*')) {
      issues.push('Contains asterisks (possible RP actions)');
    }
    
    if (response.match(/^[A-Za-z\s]*:/)) {
      issues.push('Contains character name prefix');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      characterCount: response.length,
      characterLimit: characterLimit,
      discordSafe: response.length <= this.discordMessageLimit
    };
  }

  // Utility method to estimate how much the response was truncated
  getTruncationInfo(originalLength, finalLength, characterLimit) {
    const wasTruncated = finalLength < originalLength;
    const truncationPercentage = wasTruncated 
      ? Math.round(((originalLength - finalLength) / originalLength) * 100)
      : 0;
      
    return {
      wasTruncated,
      originalLength,
      finalLength,
      characterLimit,
      truncationPercentage,
      savedCharacters: originalLength - finalLength
    };
  }
}

module.exports = ResponseFormatter;