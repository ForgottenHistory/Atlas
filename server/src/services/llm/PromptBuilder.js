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
      maxHistoryLength = 10
    } = context;

    let prompt = '';

    // 1. System prompt - use strict one if none provided
    prompt += this.formatSystemPrompt(systemPrompt || this.strictSystemPrompt);

    // 2. Character identity
    prompt += this.formatCharacterIdentity(characterName, characterDescription);

    // 3. Example messages (cleaned up)
    prompt += this.formatExampleMessages(exampleMessages, characterName);

    // 4. Conversation history (limited)
    prompt += this.formatConversationHistory(conversationHistory, maxHistoryLength);

    // 5. Response instruction
    prompt += this.formatResponseInstruction(characterName);

    return prompt;
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
    
    let section = 'Example messages (respond in similar style but without actions or formatting):\n';
    
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

  formatConversationHistory(history, maxLength) {
    if (!history || history.length === 0) return '';
    
    // Take the most recent messages
    const recentHistory = history.slice(-maxLength);
    
    let section = 'Recent conversation:\n';
    recentHistory.forEach(message => {
      const author = message.author || 'User';
      const content = message.content || '';
      section += `${author}: ${content}\n`;
    });
    
    return section + '\n';
  }

  formatResponseInstruction(characterName) {
    const name = characterName || 'Assistant';
    return `Respond as ${name} in plain text (no actions, no formatting, no character name prefix). Just the message content:\n`;
  }

  // Utility method to estimate token count (rough approximation)
  estimateTokenCount(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

module.exports = PromptBuilder;