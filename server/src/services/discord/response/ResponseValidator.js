class ResponseValidator {
  // Method to validate response context before generation
  validateResponseContext(context) {
    const issues = [];
    
    if (!context.characterName) {
      issues.push('No character name defined');
    }
    
    if (!context.characterDescription) {
      issues.push('No character description defined');
    }
    
    if (!context.llmSettings?.model) {
      issues.push('No LLM model selected');
    }
    
    if (!context.conversationHistory || context.conversationHistory.length === 0) {
      issues.push('No conversation history available');
    }
    
    // Check for empty or invalid settings
    if (context.llmSettings?.context_limit && context.llmSettings.context_limit < 512) {
      issues.push('Context limit too low (minimum 512 tokens recommended)');
    }
    
    if (context.llmSettings?.max_characters && context.llmSettings.max_characters < 50) {
      issues.push('Max characters too low (minimum 50 characters recommended)');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations: this.getContextRecommendations(context, issues)
    };
  }

  getContextRecommendations(context, issues) {
    const recommendations = [];
    
    if (issues.includes('No character name defined')) {
      recommendations.push('Set a character name in the Persona settings');
    }
    
    if (issues.includes('No character description defined')) {
      recommendations.push('Add a character description in the Persona settings');
    }
    
    if (issues.includes('No LLM model selected')) {
      recommendations.push('Choose an LLM model in the Settings');
    }
    
    if (context.llmSettings?.context_limit && context.llmSettings.context_limit < 1024) {
      recommendations.push('Consider increasing context limit for better conversation memory');
    }
    
    if (!context.exampleMessages || context.exampleMessages.trim().length === 0) {
      recommendations.push('Add example messages in Persona settings for better character consistency');
    }
    
    if (!context.systemPrompt || context.systemPrompt.trim().length === 0) {
      recommendations.push('Consider adding a system prompt for better AI behavior control');
    }
    
    return recommendations;
  }

  // Method to validate generated response quality
  validateGeneratedResponse(response, metadata = {}) {
    const issues = [];
    const warnings = [];
    
    if (!response || response.trim().length === 0) {
      issues.push('Empty response generated');
      return { isValid: false, issues, warnings };
    }
    
    if (response.length < 3) {
      issues.push('Response too short');
    }
    
    if (response.length > 2000) {
      warnings.push('Response exceeds Discord character limit');
    }
    
    // Check for common formatting issues
    if (response.includes('*') && response.match(/\*[^*]*\*/)) {
      warnings.push('Response contains asterisk actions (may not be desired)');
    }
    
    if (response.match(/^[A-Za-z\s]*:/)) {
      warnings.push('Response starts with character name prefix');
    }
    
    // Check metadata warnings
    if (metadata.truncationInfo?.wasTruncated) {
      warnings.push(`Response was truncated by ${metadata.truncationInfo.truncationPercentage}%`);
    }
    
    if (metadata.tokenUsage?.messagesIncluded === 0) {
      warnings.push('No conversation history included in context');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      responseLength: response.length,
      quality: this.assessResponseQuality(response, metadata)
    };
  }

  assessResponseQuality(response, metadata) {
    let score = 100;
    
    // Deduct points for various issues
    if (response.length < 10) score -= 30;
    if (response.length > 1500) score -= 10;
    if (metadata.truncationInfo?.wasTruncated) score -= 20;
    if (!metadata.tokenUsage?.messagesIncluded || metadata.tokenUsage.messagesIncluded === 0) score -= 15;
    if (response.includes('*')) score -= 10;
    if (response.match(/^[A-Za-z\s]*:/)) score -= 15;
    
    // Bonus points for good characteristics
    if (response.length >= 50 && response.length <= 300) score += 10;
    if (metadata.tokenUsage?.messagesIncluded > 3) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }
}

module.exports = ResponseValidator;