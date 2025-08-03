class ResponseAnalyzer {
  analyzeResponse(response, metadata = {}) {
    const analysis = {
      length: response.length,
      wordCount: this.countWords(response),
      sentenceCount: this.countSentences(response),
      qualityScore: this.calculateQualityScore(response, metadata),
      issues: this.identifyIssues(response),
      suggestions: this.generateSuggestions(response, metadata),
      readability: this.assessReadability(response),
      tone: this.analyzeTone(response)
    };
    
    return analysis;
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  countSentences(text) {
    return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
  }

  calculateQualityScore(response, metadata) {
    let score = 100;
    
    // Length penalties and bonuses
    if (response.length < 20) score -= 30;
    if (response.length > 1500) score -= 10;
    if (response.length >= 50 && response.length <= 300) score += 10;
    
    // Truncation penalty
    if (metadata.truncationInfo?.wasTruncated) {
      score -= metadata.truncationInfo.truncationPercentage * 0.5;
    }
    
    // Formatting issues
    if (response.includes('*')) score -= 15;
    if (response.match(/^[A-Za-z\s]*:/)) score -= 20;
    
    // Word count bonus
    const wordCount = this.countWords(response);
    if (wordCount >= 10 && wordCount <= 200) score += 10;
    
    // Token usage efficiency
    if (metadata.tokenUsage?.messagesIncluded > 0) score += 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  identifyIssues(response) {
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
    
    if (this.hasRepeatedPhrases(response)) {
      issues.push('Contains repeated phrases');
    }
    
    if (this.hasIncompleteWords(response)) {
      issues.push('Contains incomplete or cut-off words');
    }
    
    return issues;
  }

  generateSuggestions(response, metadata) {
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
    
    const wordCount = this.countWords(response);
    if (wordCount > 300) {
      suggestions.push('Response is very long - consider reducing max_characters for faster reading');
    }
    
    if (this.hasLowVariety(response)) {
      suggestions.push('Response has low word variety - consider adjusting temperature or prompt');
    }
    
    return suggestions;
  }

  assessReadability(response) {
    const wordCount = this.countWords(response);
    const sentenceCount = this.countSentences(response);
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    let readabilityLevel = 'medium';
    if (avgWordsPerSentence < 12) readabilityLevel = 'easy';
    if (avgWordsPerSentence > 20) readabilityLevel = 'difficult';
    
    return {
      level: readabilityLevel,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      wordCount: wordCount,
      sentenceCount: sentenceCount
    };
  }

  analyzeTone(response) {
    const lowerResponse = response.toLowerCase();
    
    // Simple tone analysis based on keywords
    const positiveWords = ['good', 'great', 'awesome', 'amazing', 'love', 'happy', 'excellent', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'frustrated', 'disappointed'];
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    const enthusiasticWords = ['wow', 'incredible', 'amazing', 'fantastic', 'brilliant'];
    
    const positiveCount = positiveWords.filter(word => lowerResponse.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerResponse.includes(word)).length;
    const questionCount = questionWords.filter(word => lowerResponse.includes(word)).length;
    const enthusiasticCount = enthusiasticWords.filter(word => lowerResponse.includes(word)).length;
    
    let tone = 'neutral';
    if (enthusiasticCount > 0) tone = 'enthusiastic';
    else if (positiveCount > negativeCount) tone = 'positive';
    else if (negativeCount > positiveCount) tone = 'negative';
    else if (questionCount > 0) tone = 'inquisitive';
    
    return {
      tone: tone,
      confidence: this.calculateToneConfidence(positiveCount, negativeCount, enthusiasticCount),
      indicators: {
        positive: positiveCount,
        negative: negativeCount,
        questions: questionCount,
        enthusiastic: enthusiasticCount
      }
    };
  }

  calculateToneConfidence(positive, negative, enthusiastic) {
    const total = positive + negative + enthusiastic;
    if (total === 0) return 'low';
    if (total >= 3) return 'high';
    return 'medium';
  }

  hasRepeatedPhrases(response) {
    const words = response.toLowerCase().split(/\s+/);
    const phrases = [];
    
    // Check for repeated 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      phrases.push(phrase);
    }
    
    const uniquePhrases = new Set(phrases);
    return phrases.length > uniquePhrases.size;
  }

  hasIncompleteWords(response) {
    // Check for words that end abruptly or seem cut off
    const words = response.split(/\s+/);
    const lastWord = words[words.length - 1];
    
    // Simple heuristic: if last word is very short or ends with common prefixes
    return lastWord.length < 3 && response.length > 50;
  }

  hasLowVariety(response) {
    const words = response.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const uniqueWords = new Set(words);
    
    if (words.length === 0) return false;
    
    const varietyRatio = uniqueWords.size / words.length;
    return varietyRatio < 0.6; // Less than 60% unique words
  }

  compareResponses(responses) {
    return responses.map(response => ({
      response: response.text || response,
      analysis: this.analyzeResponse(response.text || response, response.metadata),
      ranking: this.rankResponse(response.text || response, response.metadata)
    })).sort((a, b) => b.ranking - a.ranking);
  }

  rankResponse(response, metadata) {
    const analysis = this.analyzeResponse(response, metadata);
    let ranking = analysis.qualityScore;
    
    // Adjust ranking based on specific criteria
    ranking += Math.min(10, analysis.wordCount / 10); // Bonus for reasonable length
    ranking -= analysis.issues.length * 5; // Penalty for issues
    
    // Bonus for good readability
    if (analysis.readability.level === 'easy') ranking += 5;
    
    // Bonus for positive tone
    if (analysis.tone.tone === 'positive' || analysis.tone.tone === 'enthusiastic') ranking += 3;
    
    return Math.max(0, Math.min(100, ranking));
  }

  generateDetailedReport(response, metadata = {}) {
    const analysis = this.analyzeResponse(response, metadata);
    
    return {
      response: {
        text: response,
        length: response.length,
        preview: response.substring(0, 100) + (response.length > 100 ? '...' : '')
      },
      metrics: {
        qualityScore: analysis.qualityScore,
        wordCount: analysis.wordCount,
        sentenceCount: analysis.sentenceCount,
        readability: analysis.readability,
        tone: analysis.tone
      },
      issues: analysis.issues,
      suggestions: analysis.suggestions,
      metadata: metadata,
      analysis: {
        strengths: this.identifyStrengths(analysis),
        weaknesses: this.identifyWeaknesses(analysis),
        overallAssessment: this.getOverallAssessment(analysis)
      },
      generatedAt: new Date().toISOString()
    };
  }

  identifyStrengths(analysis) {
    const strengths = [];
    
    if (analysis.qualityScore > 80) strengths.push('High quality score');
    if (analysis.issues.length === 0) strengths.push('No formatting issues detected');
    if (analysis.readability.level === 'easy') strengths.push('Good readability');
    if (analysis.tone.tone === 'positive') strengths.push('Positive tone');
    if (analysis.wordCount >= 20 && analysis.wordCount <= 100) strengths.push('Appropriate length');
    
    return strengths;
  }

  identifyWeaknesses(analysis) {
    const weaknesses = [];
    
    if (analysis.qualityScore < 60) weaknesses.push('Low quality score');
    if (analysis.issues.length > 2) weaknesses.push('Multiple formatting issues');
    if (analysis.readability.level === 'difficult') weaknesses.push('Poor readability');
    if (analysis.tone.tone === 'negative') weaknesses.push('Negative tone detected');
    if (analysis.wordCount < 10) weaknesses.push('Too short');
    if (analysis.wordCount > 300) weaknesses.push('Too long');
    
    return weaknesses;
  }

  getOverallAssessment(analysis) {
    if (analysis.qualityScore >= 80 && analysis.issues.length === 0) {
      return 'Excellent - High quality response with no issues';
    } else if (analysis.qualityScore >= 60 && analysis.issues.length <= 1) {
      return 'Good - Solid response with minor room for improvement';
    } else if (analysis.qualityScore >= 40) {
      return 'Fair - Acceptable response with some areas for improvement';
    } else {
      return 'Poor - Response needs significant improvement';
    }
  }
}

module.exports = ResponseAnalyzer;