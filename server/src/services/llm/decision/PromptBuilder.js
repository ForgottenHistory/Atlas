const storage = require('../../../utils/storage');

class PromptBuilder {
  buildQuickDecisionPrompt(message, channelContext) {
    const persona = storage.getPersona();
    
    // Build image context if available
    let imageContext = '';
    if (channelContext.hasImages && message.imageAnalysis) {
      const analyses = Array.isArray(message.imageAnalysis) ? message.imageAnalysis : [message.imageAnalysis];
      imageContext = `\nIMAGES SHARED:\n${analyses.map((analysis, index) => 
        `Image ${index + 1}: ${analysis.analysis.substring(0, 200)}...`
      ).join('\n')}\n`;
    }

    // Build conversation context
    let conversationContext = '';
    if (channelContext.conversationHistory && channelContext.conversationHistory.length > 0) {
      const recentMessages = channelContext.conversationHistory.slice(-3);
      conversationContext = `\nRECENT CONVERSATION:\n${recentMessages.map(msg => 
        `${msg.author}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
      ).join('\n')}\n`;
    }

    return `You are ${persona.name || 'Atlas'}, a Discord bot with autonomous decision-making.

Your personality: ${persona.description || 'A helpful, engaging bot'}

Current situation:
- Channel: ${channelContext.channelName} in ${channelContext.serverName}
- Recent activity level: ${channelContext.activityLevel || 'normal'}
- Your last action: ${channelContext.lastAction || 'none'} (${this.timeSinceLastAction()} ago)

${conversationContext}
New message to analyze:
Author: ${message.author.username}
Content: "${message.content}"
${imageContext}

DECISION TIME: Choose ONE action and provide reasoning.

Respond in this EXACT format:
ACTION: [respond|reply|react|ignore|status_change]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]
EMOJI: [only if ACTION is react, otherwise leave blank]
STATUS: [only if ACTION is status_change: online|away|dnd|invisible]

Guidelines:
- respond: Generate a full conversational response (normal send) - use for general chat, flowing conversation
- reply: Generate a response using Discord's reply function (creates visual connection) - use for direct questions, specific references to previous messages, or when you need to emphasize you're responding to something specific
- react: Add emoji reaction to their message  
- ignore: Take no action, let conversation flow
- status_change: Update your Discord status

Consider:
- Don't respond to every message (be selective like a human)
- Use respond for most casual conversation and general chat
- Use reply only when the message is clearly directed at you or references something specific
- React to funny/interesting content or images
- Images often warrant some kind of response or reaction
- Change status based on mood/activity
- Avoid being too chatty or annoying
- If someone shares an image, consider acknowledging it

Context clues for reply vs respond:
- Reply: Direct questions, "@mentions", specific references to your previous responses, corrections, formal requests
- Respond: General conversation, flowing chat, observations, casual remarks, continuing discussion naturally`;
  }

  buildChannelAnalysisPrompt(analysisContext) {
    const persona = storage.getPersona();
    
    return `You are ${persona.name || 'Atlas'} analyzing channel activity for proactive engagement.

Channel: ${analysisContext.channelName} in ${analysisContext.serverName}
Activity Level: ${analysisContext.activityLevel}
Participants: ${analysisContext.participantCount} people
Recent messages (last 5):
${analysisContext.messagesSummary}

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
- Would your input add value?
- Are there images that might spark conversation?`;
  }

  buildConservativeDecisionPrompt(message, channelContext) {
    const basePrompt = this.buildQuickDecisionPrompt(message, channelContext);
    
    return basePrompt + `\n\nCONSERVATIVE MODE: Be more selective about when to respond. Only engage when:
- Directly addressed or mentioned
- Clear questions are asked
- Images are shared that clearly warrant comment
- Conversation specifically involves topics you should respond to
Default to 'ignore' unless there's a compelling reason to respond.`;
  }

  buildAggressiveDecisionPrompt(message, channelContext) {
    const basePrompt = this.buildQuickDecisionPrompt(message, channelContext);
    
    return basePrompt + `\n\nAGGRESSIVE MODE: Be more engaging and proactive. Consider responding when:
- You have something interesting to add to the conversation
- The topic aligns with your personality
- You can provide helpful information or insights
- The conversation seems to be dying down and could use energy
- Images are shared (almost always react or respond)
Favor engagement over silence, but still be natural.`;
  }

  buildImageFocusedDecisionPrompt(message, channelContext) {
    const basePrompt = this.buildQuickDecisionPrompt(message, channelContext);
    
    return basePrompt + `\n\nIMAGE FOCUS MODE: This message contains images. Consider:
- Images often deserve acknowledgment (react or respond)
- What do the images show? Are they interesting, funny, impressive?
- Does the image content relate to ongoing conversation?
- Would a reaction emoji be more appropriate than a full response?
- Images are social content - ignoring them completely can seem antisocial
Strongly favor some form of engagement (react/respond) over ignore for image messages.`;
  }

  timeSinceLastAction() {
    // This would typically come from the DecisionTracker
    // For now, return a placeholder
    return 'unknown';
  }

  buildTestDecisionPrompt(testScenario) {
    const persona = storage.getPersona();
    
    return `You are ${persona.name || 'Atlas'} in a test scenario: ${testScenario.description}

Test message:
Author: ${testScenario.author}
Content: "${testScenario.content}"
Channel: ${testScenario.channel}

What would you do? Use the standard decision format:
ACTION: [respond|reply|react|ignore|status_change]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]
EMOJI: [only if ACTION is react]
STATUS: [only if ACTION is status_change]`;
  }

  buildBatchDecisionPrompt(messages, context) {
    const persona = storage.getPersona();
    
    const messageList = messages.map((msg, index) => 
      `${index + 1}. ${msg.author.username}: "${msg.content}"`
    ).join('\n');

    return `You are ${persona.name || 'Atlas'} analyzing multiple messages for batch decision making.

Context: ${context.channelName} in ${context.serverName}
Activity: ${context.activityLevel}

Messages to analyze:
${messageList}

For each message, decide what action to take. Respond with:
MESSAGE_1: ACTION=[action] CONFIDENCE=[0.0-1.0] REASONING=[reason]
MESSAGE_2: ACTION=[action] CONFIDENCE=[0.0-1.0] REASONING=[reason]
[etc...]

Consider the flow of conversation and avoid responding to every single message.`;
  }
}

module.exports = PromptBuilder;