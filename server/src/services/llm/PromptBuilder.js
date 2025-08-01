class PromptBuilder {
  constructor() {
    this.defaultSystemPrompt = "You are a helpful AI assistant. Respond naturally and stay in character.";
  }

  buildCharacterPrompt(context) {
    const {
      systemPrompt,
      characterName,
      characterDescription,
      exampleMessages,
      conversationHistory = [],
      maxHistoryLength = 10
    } = context;

    let prompt = '';

    // 1. System prompt
    prompt += this.formatSystemPrompt(systemPrompt);

    // 2. Character identity
    prompt += this.formatCharacterIdentity(characterName, characterDescription);

    // 3. Example messages
    prompt += this.formatExampleMessages(exampleMessages, characterName);

    // 4. Conversation history (limited)
    prompt += this.formatConversationHistory(conversationHistory, maxHistoryLength);

    // 5. Response prefix
    prompt += this.formatResponsePrefix(characterName);

    return prompt;
  }

  formatSystemPrompt(systemPrompt) {
    const prompt = systemPrompt || this.defaultSystemPrompt;
    return `${prompt}\n\n`;
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
    
    // If examples don't already have character name tags, add them
    const examples = exampleMessages.trim();
    if (characterName && !examples.includes(`${characterName}:`)) {
      // Simple format - assume each line is an example
      const lines = examples.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        section += `${characterName}: ${line.trim()}\n`;
      });
    } else {
      section += examples + '\n';
    }
    
    return section + '\n';
  }

  formatConversationHistory(history, maxLength) {
    if (!history || history.length === 0) return '';
    
    // Take the most recent messages
    const recentHistory = history.slice(-maxLength);
    
    let section = 'Conversation:\n';
    recentHistory.forEach(message => {
      const author = message.author || 'User';
      const content = message.content || '';
      section += `${author}: ${content}\n`;
    });
    
    return section + '\n';
  }

  formatResponsePrefix(characterName) {
    const name = characterName || 'Assistant';
    return `${name}:`;
  }

  // Utility method to estimate token count (rough approximation)
  estimateTokenCount(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

module.exports = PromptBuilder;