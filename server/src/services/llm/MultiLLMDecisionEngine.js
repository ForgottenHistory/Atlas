const LLMServiceSingleton = require('./LLMServiceSingleton');
const logger = require('../logger/Logger');

class MultiLLMDecisionEngine {
  constructor() {
    this.llmService = LLMServiceSingleton.getInstance();
    this.lastDecisionTime = new Date();
    
    logger.info('Multi-LLM Decision Engine initialized', {
      source: 'llm',
      features: ['QuickDecision', 'FullResponse', 'BackgroundAnalysis']
    });
  }

  /**
   * Quick decision making (should use 34B model)
   * Decides what action to take without generating full response
   */
  async makeQuickDecision(message, channelContext) {
    try {
      const prompt = this.buildQuickDecisionPrompt(message, channelContext);
      
      const result = await this.llmService.generateCustomResponse(prompt, {
        model: 'moonshotai/Kimi-K2-Instruct', // For now, we'll optimize this later
        temperature: 0.3,
        max_tokens: 150,
        top_p: 0.9
      });

      if (result.success) {
        return this.parseDecisionResponse(result.response);
      }

      return this.getDefaultDecision();
    } catch (error) {
      logger.error('Quick decision failed', {
        source: 'llm',
        error: error.message,
        fallback: 'ignore'
      });
      return this.getDefaultDecision();
    }
  }

  /**
   * Analyze if bot should proactively engage with channel
   */
  async analyzeChannelActivity(recentMessages, channelInfo) {
    try {
      const prompt = this.buildChannelAnalysisPrompt(recentMessages, channelInfo);
      
      const result = await this.llmService.generateCustomResponse(prompt, {
        temperature: 0.4,
        max_tokens: 100,
        top_p: 0.9
      });

      if (result.success) {
        return this.parseChannelAnalysis(result.response);
      }

      return { shouldEngage: false, confidence: 0, reasoning: 'Analysis failed' };
    } catch (error) {
      logger.error('Channel analysis failed', {
        source: 'llm',
        error: error.message
      });
      return { shouldEngage: false, confidence: 0, reasoning: 'Error occurred' };
    }
  }

  buildQuickDecisionPrompt(message, channelContext) {
    const persona = require('../../utils/storage').getPersona();
    
    return `You are ${persona.name || 'Atlas'}, a Discord bot with autonomous decision-making.

Your personality: ${persona.description || 'A helpful, engaging bot'}

Current situation:
- Channel: ${channelContext.channelName} in ${channelContext.serverName}
- Recent activity level: ${channelContext.activityLevel || 'normal'}
- Your last action: ${channelContext.lastAction || 'none'} (${this.timeSinceLastAction()} ago)

New message to analyze:
Author: ${message.author.username}
Content: "${message.content}"

DECISION TIME: Choose ONE action and provide reasoning.

Respond in this EXACT format:
ACTION: [respond|react|ignore|status_change]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]
EMOJI: [only if ACTION is react, otherwise leave blank]
STATUS: [only if ACTION is status_change: online|away|dnd|invisible]

Guidelines:
- respond: Generate a full conversational response
- react: Add emoji reaction to their message  
- ignore: Take no action, let conversation flow
- status_change: Update your Discord status

Consider:
- Don't respond to every message (be selective like a human)
- React to funny/interesting content
- Change status based on mood/activity
- Avoid being too chatty or annoying`;
  }

  buildChannelAnalysisPrompt(recentMessages, channelInfo) {
    const persona = require('../../utils/storage').getPersona();
    
    const messagesSummary = recentMessages.slice(0, 5).map(msg => 
      `${msg.author}: ${msg.content.substring(0, 100)}`
    ).join('\n');

    return `You are ${persona.name || 'Atlas'} analyzing channel activity for proactive engagement.

Channel: ${channelInfo.channelName} in ${channelInfo.serverName}
Recent messages (last 5):
${messagesSummary}

Should you proactively start a conversation or comment on the current topic?

Respond in this EXACT format:
ENGAGE: [yes|no]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]

Consider:
- Is the topic interesting to you?
- Is there a natural conversation entry point?
- Are people actively chatting?
- Have you been quiet for a while?
- Would your input add value?`;
  }

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
          if (['respond', 'react', 'ignore', 'status_change'].includes(action)) {
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

  getDefaultDecision() {
    return {
      action: 'ignore',
      confidence: 0.1,
      reasoning: 'Default fallback decision',
      emoji: null,
      status: null
    };
  }

  timeSinceLastAction() {
    const now = new Date();
    const diffMs = now - this.lastDecisionTime;
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m`;
    return `${Math.floor(diffSecs / 3600)}h`;
  }

  updateLastActionTime() {
    this.lastDecisionTime = new Date();
  }
}

module.exports = MultiLLMDecisionEngine;