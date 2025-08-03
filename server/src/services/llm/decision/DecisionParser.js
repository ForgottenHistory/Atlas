const logger = require('../../logger/Logger');

class DecisionParser {
  parseDecisionResponse(response) {
    try {
      const lines = response.split('\n').map(line => line.trim());
      const decision = {
        action: 'ignore',
        confidence: 0.1,
        reasoning: 'Failed to parse decision',
        emoji: null,
        status: null
      };

      for (const line of lines) {
        if (line.startsWith('ACTION:')) {
          const action = line.split(':')[1].trim().toLowerCase();
          if (['respond', 'reply', 'react', 'ignore', 'status_change'].includes(action)) {
            decision.action = action;
          }
        } else if (line.startsWith('CONFIDENCE:')) {
          const conf = parseFloat(line.split(':')[1].trim());
          if (!isNaN(conf) && conf >= 0 && conf <= 1) {
            decision.confidence = conf;
          }
        } else if (line.startsWith('REASONING:')) {
          decision.reasoning = line.split(':')[1].trim();
        } else if (line.startsWith('EMOJI:')) {
          const emoji = line.split(':')[1].trim();
          if (emoji && emoji !== '') {
            decision.emoji = emoji;
          }
        } else if (line.startsWith('STATUS:')) {
          const status = line.split(':')[1].trim().toLowerCase();
          if (['online', 'away', 'dnd', 'invisible'].includes(status)) {
            decision.status = status;
          }
        }
      }

      logger.debug('Decision parsed successfully', {
        source: 'llm',
        decision: decision
      });

      return decision;
    } catch (error) {
      logger.error('Failed to parse decision response', {
        source: 'llm',
        error: error.message,
        response: response
      });
      return this.getDefaultDecision();
    }
  }

  parseChannelAnalysis(response) {
    try {
      const lines = response.split('\n').map(line => line.trim());
      const analysis = {
        shouldEngage: false,
        confidence: 0,
        reasoning: 'Failed to parse'
      };

      for (const line of lines) {
        if (line.startsWith('ENGAGE:')) {
          const engage = line.split(':')[1].trim().toLowerCase();
          analysis.shouldEngage = engage === 'yes';
        } else if (line.startsWith('CONFIDENCE:')) {
          const conf = parseFloat(line.split(':')[1].trim());
          if (!isNaN(conf)) {
            analysis.confidence = conf;
          }
        } else if (line.startsWith('REASONING:')) {
          analysis.reasoning = line.split(':')[1].trim();
        }
      }

      return analysis;
    } catch (error) {
      return { shouldEngage: false, confidence: 0, reasoning: 'Parse error' };
    }
  }

  parseBatchDecisions(response) {
    try {
      const lines = response.split('\n').map(line => line.trim());
      const decisions = [];

      for (const line of lines) {
        if (line.startsWith('MESSAGE_')) {
          const decision = this.parseBatchDecisionLine(line);
          if (decision) {
            decisions.push(decision);
          }
        }
      }

      return decisions;
    } catch (error) {
      logger.error('Failed to parse batch decisions', {
        source: 'llm',
        error: error.message,
        response: response
      });
      return [];
    }
  }

  parseBatchDecisionLine(line) {
    try {
      // Parse line like: MESSAGE_1: ACTION=respond CONFIDENCE=0.8 REASONING=User asked question
      const parts = line.split(':');
      if (parts.length < 2) return null;

      const messageNum = parseInt(parts[0].replace('MESSAGE_', ''));
      const content = parts[1].trim();

      const decision = {
        messageIndex: messageNum - 1, // Convert to 0-based index
        action: 'ignore',
        confidence: 0.1,
        reasoning: 'Unknown'
      };

      // Parse ACTION=value
      const actionMatch = content.match(/ACTION=(\w+)/);
      if (actionMatch) {
        decision.action = actionMatch[1].toLowerCase();
      }

      // Parse CONFIDENCE=value
      const confidenceMatch = content.match(/CONFIDENCE=([\d.]+)/);
      if (confidenceMatch) {
        decision.confidence = parseFloat(confidenceMatch[1]);
      }

      // Parse REASONING=value (rest of the line after REASONING=)
      const reasoningMatch = content.match(/REASONING=(.+)/);
      if (reasoningMatch) {
        decision.reasoning = reasoningMatch[1].trim();
      }

      return decision;
    } catch (error) {
      logger.error('Failed to parse batch decision line', {
        source: 'llm',
        error: error.message,
        line: line
      });
      return null;
    }
  }

  getDefaultDecision() {
    return {
      action: 'ignore',
      confidence: 0.1,
      reasoning: 'Default fallback decision',
      emoji: null,
      status: null
    };
  }

  validateDecision(decision) {
    const validActions = ['respond', 'reply', 'react', 'ignore', 'status_change'];
    const issues = [];

    if (!decision.action || !validActions.includes(decision.action)) {
      issues.push('Invalid action');
    }

    if (decision.confidence < 0 || decision.confidence > 1) {
      issues.push('Invalid confidence value');
    }

    if (!decision.reasoning || decision.reasoning.trim() === '') {
      issues.push('Missing reasoning');
    }

    if (decision.action === 'react' && !decision.emoji) {
      issues.push('React action requires emoji');
    }

    if (decision.action === 'status_change' && !decision.status) {
      issues.push('Status change action requires status');
    }

    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }

  normalizeDecision(decision) {
    // Ensure decision has all required fields with defaults
    return {
      action: decision.action || 'ignore',
      confidence: Math.max(0, Math.min(1, decision.confidence || 0.1)),
      reasoning: decision.reasoning || 'No reasoning provided',
      emoji: decision.emoji || null,
      status: decision.status || null,
      timestamp: new Date().toISOString()
    };
  }

  getDecisionSummary(decision) {
    const summary = {
      action: decision.action,
      confidence: `${Math.round(decision.confidence * 100)}%`,
      reasoning: decision.reasoning
    };

    if (decision.emoji) {
      summary.emoji = decision.emoji;
    }

    if (decision.status) {
      summary.status = decision.status;
    }

    return summary;
  }

  // Enhanced parsing with fallback strategies
  parseDecisionWithFallback(response) {
    // Try standard parsing first
    let decision = this.parseDecisionResponse(response);
    
    // If parsing failed, try alternative strategies
    if (decision.action === 'ignore' && decision.reasoning === 'Failed to parse decision') {
      decision = this.attemptFuzzyParsing(response);
    }

    // Normalize and validate
    decision = this.normalizeDecision(decision);
    const validation = this.validateDecision(decision);
    
    if (!validation.isValid) {
      logger.warn('Decision validation failed', {
        source: 'llm',
        issues: validation.issues,
        decision: decision
      });
      // Return default decision if validation fails
      return this.getDefaultDecision();
    }

    return decision;
  }

  attemptFuzzyParsing(response) {
    // Attempt to extract decision from free-form text
    const lowerResponse = response.toLowerCase();
    
    let action = 'ignore';
    let confidence = 0.3;
    let reasoning = 'Fuzzy parsing attempt';

    // Look for action keywords
    if (lowerResponse.includes('respond') || lowerResponse.includes('answer')) {
      action = 'respond';
      confidence = 0.6;
    } else if (lowerResponse.includes('reply')) {
      action = 'reply';
      confidence = 0.6;
    } else if (lowerResponse.includes('react') || lowerResponse.includes('emoji')) {
      action = 'react';
      confidence = 0.5;
    } else if (lowerResponse.includes('status')) {
      action = 'status_change';
      confidence = 0.4;
    }

    // Extract reasoning from the response
    reasoning = response.substring(0, 100).trim() || reasoning;

    return {
      action,
      confidence,
      reasoning,
      emoji: null,
      status: null
    };
  }
}

module.exports = DecisionParser;