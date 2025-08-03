class ResponseValidator {
  validateResponse(response, maxCharacters = null) {
    const issues = [];
    const warnings = [];
    const discordMessageLimit = 2000;
    const characterLimit = maxCharacters || discordMessageLimit;
    
    // Basic validation
    if (!response || response.trim().length === 0) {
      issues.push('Empty response');
      return {
        isValid: false,
        issues,
        warnings,
        characterCount: 0,
        characterLimit: characterLimit,
        discordSafe: false
      };
    }
    
    if (response.length < 3) {
      issues.push('Response too short');
    }
    
    if (response.length > characterLimit) {
      issues.push(`Response exceeds character limit (${response.length}/${characterLimit})`);
    }
    
    if (response.length > discordMessageLimit) {
      issues.push(`Response exceeds Discord limit (${response.length}/${discordMessageLimit})`);
    }
    
    // Check for remaining formatting artifacts
    if (response.includes('*')) {
      warnings.push('Contains asterisks (possible RP actions)');
    }
    
    if (response.match(/^[A-Za-z\s]*:/)) {
      warnings.push('Contains character name prefix');
    }
    
    // Check for other issues
    if (response.includes('```')) {
      warnings.push('Contains code blocks');
    }
    
    if (this.hasIncompleteEnding(response)) {
      warnings.push('Response appears to end abruptly');
    }
    
    if (this.hasRepeatedContent(response)) {
      warnings.push('Contains repeated content');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      characterCount: response.length,
      characterLimit: characterLimit,
      discordSafe: response.length <= discordMessageLimit
    };
  }

  hasIncompleteEnding(response) {
    // Check if response ends mid-sentence or word
    const trimmed = response.trim();
    if (trimmed.length === 0) return false;
    
    const lastChar = trimmed[trimmed.length - 1];
    const endsWithPunctuation = ['.', '!', '?', '"', "'"].includes(lastChar);
    
    // If it doesn't end with punctuation and is long enough, might be incomplete
    return !endsWithPunctuation && trimmed.length > 20;
  }

  hasRepeatedContent(response) {
    // Simple check for obviously repeated phrases
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    
    // If we have significantly fewer unique sentences than total, there's repetition
    return sentences.length > 2 && uniqueSentences.size < sentences.length * 0.8;
  }

  validateResponseContext(context) {
    const issues = [];
    const warnings = [];
    
    if (!context) {
      issues.push('No context provided');
      return { isValid: false, issues, warnings };
    }
    
    // Required fields
    if (!context.characterName) {
      warnings.push('No character name provided');
    }
    
    if (!context.characterDescription) {
      warnings.push('No character description provided');
    }
    
    if (!context.llmSettings) {
      issues.push('LLM settings are required');
    } else {
      // Validate LLM settings
      if (!context.llmSettings.context_limit || context.llmSettings.context_limit < 512) {
        warnings.push('Context limit is very low or not set');
      }
      
      if (!context.llmSettings.max_characters) {
        warnings.push('Max characters not set');
      }
      
      if (context.llmSettings.max_characters > 2000) {
        warnings.push('Max characters exceeds Discord limit');
      }
    }
    
    // Conversation history validation
    if (context.conversationHistory && !Array.isArray(context.conversationHistory)) {
      issues.push('Conversation history must be an array');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  validateBatchResponses(responses) {
    const results = responses.map((response, index) => {
      const validation = this.validateResponse(response.text || response, response.maxCharacters);
      return {
        index,
        response: response.text || response,
        validation,
        isValid: validation.isValid
      };
    });
    
    const totalResponses = results.length;
    const validResponses = results.filter(r => r.isValid).length;
    const successRate = totalResponses > 0 ? (validResponses / totalResponses) * 100 : 0;
    
    return {
      totalResponses,
      validResponses,
      invalidResponses: totalResponses - validResponses,
      successRate: Math.round(successRate * 100) / 100,
      results,
      summary: this.generateBatchSummary(results)
    };
  }

  generateBatchSummary(results) {
    const allIssues = [];
    const allWarnings = [];
    
    results.forEach(result => {
      allIssues.push(...result.validation.issues);
      allWarnings.push(...result.validation.warnings);
    });
    
    // Count issue frequencies
    const issueFrequency = {};
    const warningFrequency = {};
    
    allIssues.forEach(issue => {
      issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
    });
    
    allWarnings.forEach(warning => {
      warningFrequency[warning] = (warningFrequency[warning] || 0) + 1;
    });
    
    return {
      mostCommonIssues: Object.entries(issueFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      mostCommonWarnings: Object.entries(warningFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      totalIssues: allIssues.length,
      totalWarnings: allWarnings.length
    };
  }

  validateResponseQuality(response, qualityThresholds = {}) {
    const {
      minLength = 10,
      maxLength = 2000,
      minQualityScore = 60,
      allowedIssues = 2
    } = qualityThresholds;
    
    const basicValidation = this.validateResponse(response, maxLength);
    
    // Additional quality checks
    const qualityIssues = [];
    
    if (response.length < minLength) {
      qualityIssues.push(`Response too short (${response.length} < ${minLength})`);
    }
    
    if (response.length > maxLength) {
      qualityIssues.push(`Response too long (${response.length} > ${maxLength})`);
    }
    
    // Check for quality indicators
    const wordCount = response.trim().split(/\s+/).length;
    if (wordCount < 5) {
      qualityIssues.push('Response has very few words');
    }
    
    // Check for completeness
    if (this.hasIncompleteEnding(response)) {
      qualityIssues.push('Response appears incomplete');
    }
    
    const totalIssues = basicValidation.issues.length + qualityIssues.length;
    const meetsQualityStandard = totalIssues <= allowedIssues;
    
    return {
      isValid: basicValidation.isValid,
      meetsQualityStandard,
      basicValidation,
      qualityIssues,
      totalIssues,
      recommendations: this.generateQualityRecommendations(response, qualityIssues)
    };
  }

  generateQualityRecommendations(response, qualityIssues) {
    const recommendations = [];
    
    if (qualityIssues.some(issue => issue.includes('too short'))) {
      recommendations.push('Increase max_characters or adjust prompt to encourage longer responses');
    }
    
    if (qualityIssues.some(issue => issue.includes('too long'))) {
      recommendations.push('Decrease max_characters or adjust prompt to encourage more concise responses');
    }
    
    if (qualityIssues.some(issue => issue.includes('incomplete'))) {
      recommendations.push('Check context limits - response may be getting cut off');
    }
    
    if (response.includes('*')) {
      recommendations.push('Update system prompt to prevent action descriptions');
    }
    
    return recommendations;
  }

  // Advanced validation methods
  validateResponseConsistency(responses) {
    if (responses.length < 2) {
      return {
        isConsistent: true,
        message: 'Need at least 2 responses to check consistency'
      };
    }
    
    // Check for consistency in formatting
    const hasAsterisks = responses.map(r => r.includes('*'));
    const hasPrefixes = responses.map(r => r.match(/^[A-Za-z\s]*:/));
    const lengths = responses.map(r => r.length);
    
    const asteriskConsistency = hasAsterisks.every(x => x === hasAsterisks[0]);
    const prefixConsistency = hasPrefixes.every(x => Boolean(x) === Boolean(hasPrefixes[0]));
    const lengthVariation = Math.max(...lengths) - Math.min(...lengths);
    
    const inconsistencies = [];
    if (!asteriskConsistency) inconsistencies.push('Inconsistent asterisk usage');
    if (!prefixConsistency) inconsistencies.push('Inconsistent character prefix usage');
    if (lengthVariation > 1000) inconsistencies.push('High length variation between responses');
    
    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      metrics: {
        asteriskConsistency,
        prefixConsistency,
        lengthVariation,
        avgLength: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      }
    };
  }

  validateResponseSafety(response) {
    const safetyIssues = [];
    const warnings = [];
    
    // Check for potentially harmful content patterns
    const lowerResponse = response.toLowerCase();
    
    // Check for personal information patterns (basic)
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(response)) {
      safetyIssues.push('Contains potential SSN pattern');
    }
    
    if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(response)) {
      safetyIssues.push('Contains potential credit card pattern');
    }
    
    // Check for inappropriate content indicators
    const inappropriateKeywords = ['password', 'login', 'hack', 'exploit'];
    inappropriateKeywords.forEach(keyword => {
      if (lowerResponse.includes(keyword)) {
        warnings.push(`Contains potentially sensitive keyword: ${keyword}`);
      }
    });
    
    return {
      isSafe: safetyIssues.length === 0,
      safetyIssues,
      warnings,
      recommendedAction: safetyIssues.length > 0 ? 'block' : 'allow'
    };
  }

  // Utility methods for comprehensive validation
  generateValidationReport(response, options = {}) {
    const basicValidation = this.validateResponse(response, options.maxCharacters);
    const qualityValidation = this.validateResponseQuality(response, options.qualityThresholds);
    const safetyValidation = this.validateResponseSafety(response);
    
    return {
      response: {
        text: response.substring(0, 100) + (response.length > 100 ? '...' : ''),
        length: response.length,
        wordCount: response.trim().split(/\s+/).length
      },
      validation: {
        basic: basicValidation,
        quality: qualityValidation,
        safety: safetyValidation
      },
      overallStatus: this.determineOverallStatus(basicValidation, qualityValidation, safetyValidation),
      recommendations: [
        ...basicValidation.issues.map(issue => `Fix: ${issue}`),
        ...qualityValidation.recommendations,
        ...safetyValidation.warnings.map(warning => `Review: ${warning}`)
      ],
      generatedAt: new Date().toISOString()
    };
  }

  determineOverallStatus(basic, quality, safety) {
    if (!safety.isSafe) return 'unsafe';
    if (!basic.isValid) return 'invalid';
    if (!quality.meetsQualityStandard) return 'low_quality';
    if (basic.warnings.length > 0) return 'warning';
    return 'valid';
  }
}

module.exports = ResponseValidator;