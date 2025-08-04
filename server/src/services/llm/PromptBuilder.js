class PromptBuilder {
  constructor() {
    this.strictSystemPrompt = `You are a Discord bot. Your primary goals are to:
1. **Stay Conversational**: Maintain a natural, engaging tone that fits Discord's casual environment
2. **Stay On-Topic**: Keep responses relevant to the conversation

## Response Guidelines:
- Keep responses concise but informative (aim for 1-3 sentences for most replies)
- NO roleplay actions (*does something*) 
- NO character name prefixes (CharacterName:)
- NO markdown formatting
- NO quotation marks around your entire response
- Respond directly as the character in plain text
- Be conversational and natural

## Personality Traits:
- Knowledgeable
- Engaging
- Helpful

IMPORTANT: Your response should be ONLY the dialogue/message content. No actions, no formatting, no character names. Just speak naturally.`;
  }


  buildCharacterPrompt(context) {
    const {
      systemPrompt,
      characterName,
      characterDescription,
      exampleMessages,
      conversationHistory = [],
      llmSettings = {},
      currentMessage  // NEW: The actual message being responded to
    } = context;

    // Get token limits
    const contextLimit = llmSettings.context_limit || 4096;
    const safetyBuffer = Math.ceil(contextLimit * 0.1); // 10% buffer
    const availableTokens = contextLimit - safetyBuffer;

    // Build prompt components
    const systemSection = this.formatSystemPrompt(systemPrompt || this.strictSystemPrompt);
    const characterSection = this.formatCharacterIdentity(characterName, characterDescription);
    const exampleSection = this.formatExampleMessages(exampleMessages, characterName);

    // Calculate base prompt tokens (everything except history)
    const basePrompt = systemSection + characterSection + exampleSection;
    const baseTokens = this.estimateTokenCount(basePrompt);

    // Calculate available tokens for conversation history
    const historyTokenBudget = availableTokens - baseTokens;

    // Build dynamic conversation history
    const historySection = this.buildDynamicHistory(conversationHistory, historyTokenBudget);

    // Build "You are replying to" section with the ACTUAL current message
    const replyToSection = this.buildReplyToSection(currentMessage, conversationHistory);

    // Assemble final prompt
    const finalPrompt = basePrompt + historySection + replyToSection + `${characterName}: `;

    return {
      prompt: finalPrompt,
      metadata: {
        totalTokens: this.estimateTokenCount(finalPrompt),
        baseTokens: baseTokens,
        historyTokens: this.estimateTokenCount(historySection),
        availableTokens: availableTokens,
        contextLimit: contextLimit,
        safetyBuffer: safetyBuffer,
        messagesIncluded: historySection ? this.countMessagesInHistory(historySection) : 0
      }
    };
  }

  buildDynamicHistory(conversationHistory, tokenBudget) {
    if (!conversationHistory || conversationHistory.length === 0 || tokenBudget <= 0) {
      return '';
    }

    let historySection = '## Conversation History:\n';
    let currentTokens = this.estimateTokenCount(historySection);
    let includedMessages = 0;

    // Add messages from most recent to oldest until we hit token limit
    for (const message of conversationHistory) {
      let messageText = `${message.author || 'User'}: ${message.content || ''}\n`;

      // Add image analysis if present
      if (message.imageAnalysis && Array.isArray(message.imageAnalysis)) {
        const imageContext = message.imageAnalysis.map(analysis =>
          `[Image: ${analysis.analysis.substring(0, 200)}...]`
        ).join(' ');
        messageText = `${message.author || 'User'}: ${message.content || ''} ${imageContext}\n`;
      }

      const messageTokens = this.estimateTokenCount(messageText);

      // Check if adding this message would exceed our budget
      if (currentTokens + messageTokens > tokenBudget) {
        break;
      }

      historySection += messageText;
      currentTokens += messageTokens;
      includedMessages++;
    }

    // Return empty if we couldn't fit any messages
    if (includedMessages === 0) {
      return '';
    }

    return historySection;
  }

  buildReplyToSection(currentMessage, conversationHistory) {
    // FIXED: Use the actual current message being responded to
    // instead of guessing from conversation history

    if (!currentMessage) {
      // Fallback to old behavior if currentMessage not provided
      if (!conversationHistory || conversationHistory.length === 0) {
        return '';
      }
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      if (!lastMessage) {
        return '';
      }
      return `\n## You are replying to:\n${lastMessage.author || 'User'}: ${lastMessage.content || ''}\n\n`;
    }

    // Use the actual current message that triggered this response
    let messageContent = currentMessage.content || '';

    // Add image context if present
    if (currentMessage.imageAnalysis && Array.isArray(currentMessage.imageAnalysis)) {
      const imageContext = currentMessage.imageAnalysis.map(analysis =>
        `[Image: ${analysis.analysis.substring(0, 100)}...]`
      ).join(' ');
      messageContent = `${messageContent} ${imageContext}`.trim();
    }

    return `\n## You are replying to:\n${currentMessage.author?.username || 'User'}: ${messageContent}\n\n`;
  }

  formatSystemPrompt(systemPrompt) {
    return `${systemPrompt}\n\n`;
  }

  formatCharacterIdentity(name, description) {
    if (!name && !description) return '';

    let section = '';
    if (name) {
      section += `Character: ${name}\n`;
    }
    if (description) {
      section += `Description: ${description}\n`;
    }
    return section + '\n';
  }

  formatExampleMessages(exampleMessages, characterName) {
    if (!exampleMessages || !exampleMessages.trim()) return '';

    let section = 'Example messages:\n';

    // Clean up examples to show the desired format
    const examples = exampleMessages.trim();
    const lines = examples.split('\n').filter(line => line.trim());

    lines.forEach(line => {
      // Strip character names and actions from examples
      let cleaned = line.trim()
        .replace(/^[A-Za-z\s]*\([^)]*\):\s*/gi, '') // Remove "Name (emotion):"
        .replace(/^[A-Za-z\s]*:\s*/gi, '') // Remove "Name:"
        .replace(/\*[^*]*\*/g, '') // Remove *actions*
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .trim();

      if (cleaned) {
        section += `Example: ${cleaned}\n`;
      }
    });

    return section + '\n';
  }

  countMessagesInHistory(historySection) {
    if (!historySection) return 0;

    // Count lines that look like "Author: message"
    const lines = historySection.split('\n').filter(line => line.includes(':') && line.trim() !== '');
    return Math.max(0, lines.length - 1); // Subtract 1 for the "Recent conversation:" header
  }

  // Enhanced token counting with better accuracy
  estimateTokenCount(text) {
    if (!text) return 0;

    // More accurate token estimation
    // Remove extra whitespace and normalize
    const normalized = text.replace(/\s+/g, ' ').trim();

    // Average tokens per character varies by language/content
    // For English: roughly 1 token per 3.5-4.5 characters
    // We'll use 4 as a conservative estimate
    const baseTokens = Math.ceil(normalized.length / 4);

    // Add some tokens for punctuation and special characters
    const punctuationCount = (normalized.match(/[.,!?;:()[\]{}'"]/g) || []).length;
    const specialTokens = Math.ceil(punctuationCount * 0.2);

    return baseTokens + specialTokens;
  }

  // Utility method to validate token limits
  validateTokenLimits(context) {
    const result = this.buildCharacterPrompt(context);
    const { totalTokens, contextLimit, availableTokens } = result.metadata;

    return {
      isValid: totalTokens <= availableTokens,
      usage: {
        used: totalTokens,
        available: availableTokens,
        limit: contextLimit,
        percentage: Math.round((totalTokens / availableTokens) * 100)
      },
      recommendations: this.getTokenRecommendations(result.metadata)
    };
  }

  getTokenRecommendations(metadata) {
    const recommendations = [];
    const { totalTokens, availableTokens, baseTokens, historyTokens } = metadata;

    const usage = totalTokens / availableTokens;

    if (usage > 0.9) {
      recommendations.push('Consider increasing context limit or reducing system prompt length');
    }

    if (baseTokens > availableTokens * 0.5) {
      recommendations.push('System prompt and character description are using over 50% of available tokens');
    }

    if (historyTokens < 100 && metadata.messagesIncluded < 3) {
      recommendations.push('Very limited conversation history due to token constraints');
    }

    return recommendations;
  }

  buildBatchAwareDecisionPrompt(message, channelContext) {
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

    // Build batch context
    let batchContext = '';
    if (message.originalMessages && message.originalMessages.length > 1) {
      batchContext = `\nMESSAGE BATCH DETAILS:
Total messages: ${message.originalMessages.length}
Individual messages:
${message.originalMessages.map((msg, index) =>
        `${index + 1}. ${msg.content || '[attachment/embed]'}`
      ).join('\n')}

Combined content: "${message.content}"

This user sent multiple messages in quick succession. Consider:
- Should you respond to the overall message or a specific part?
- If responding, which message should you reply to? (use 'reply' for Discord threading)
- Or should you just send a response to the channel? (use 'respond' for general chat)
- Images and questions usually deserve acknowledgment
`;
    }

    return `You are ${persona.name || 'Atlas'}, a Discord bot with autonomous decision-making.

Your personality: ${persona.description || 'A helpful, engaging bot'}

Current situation:
- Channel: ${channelContext.channelName} in ${channelContext.serverName}
- Recent activity level: ${channelContext.activityLevel || 'normal'}
- Your last action: ${channelContext.lastAction || 'none'} (${this.timeSinceLastAction()} ago)

${conversationContext}
${batchContext}

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

Guidelines for batched messages:
- respond: Send a general response to the channel (good for casual conversation flow)
- reply: Use Discord's reply feature to connect to a specific message (good for direct responses, questions, or acknowledging specific content like images)
- react: Add emoji reaction (good for quick acknowledgment)
- ignore: Take no action

For message batches, consider:
- Is there a specific message that warrants a direct reply? (use 'reply')
- Or should you just continue the conversation naturally? (use 'respond')
- Images and questions often deserve replies for better context
- Don't feel obligated to respond to every batch - be selective like a human`;
  }

  buildQuickDecisionPrompt(message, channelContext) {
    // Check if this should use batch-aware prompt
    if (message.originalMessages && message.originalMessages.length > 1) {
      return this.buildBatchAwareDecisionPrompt(message, channelContext);
    }

    // Use existing logic for single messages
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
- reply: Generate a response using Discord's reply function (creates visual connection) - use for direct questions, specific references to previous messages
- react: Add emoji reaction to their message  
- ignore: Take no action, let conversation flow
- status_change: Update your Discord status

Consider:
- Don't respond to every message (be selective like a human)
- Use respond for most casual conversation and general chat
- Use reply only when the message is clearly directed at you or references something specific
- React to funny/interesting content or images
- Images often warrant some kind of response or reaction`;
  }
}

module.exports = PromptBuilder;