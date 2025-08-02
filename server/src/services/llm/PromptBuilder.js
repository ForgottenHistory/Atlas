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
      llmSettings = {}
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

    // Build "You are replying to" section
    const replyToSection = this.buildReplyToSection(conversationHistory);

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
      const messageText = `${message.author || 'User'}: ${message.content || ''}\n`;
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

  buildReplyToSection(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return '';
    }

    // Get the most recent message (the one we're replying to)
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    
    if (!lastMessage) {
      return '';
    }

    return `\n## You are replying to:\n${lastMessage.author || 'User'}: ${lastMessage.content || ''}\n\n`;
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
}

module.exports = PromptBuilder;