const storage = require('../../../utils/storage');

class ResponseContextBuilder {
  buildContext(message, conversationManager) {
    const settings = storage.getSettings();
    const persona = storage.getPersona();
    const llmSettings = storage.getLLMSettings();
    const conversationHistory = conversationManager.getHistory(message.channel.id);

    return {
      systemPrompt: llmSettings.systemPrompt || settings.systemPrompt,
      characterName: persona.name || 'Bot',
      characterDescription: persona.description || '',
      exampleMessages: persona.mes_example || '',
      conversationHistory: conversationHistory,
      llmSettings: llmSettings,
      // FIXED: Pass the actual current message being responded to
      currentMessage: {
        content: message.content,
        author: {
          username: message.author?.username || 'Unknown'
        },
        imageAnalysis: message.imageAnalysis || null
      },
      channel: {
        id: message.channel.id,
        name: message.channel.name || 'Unknown'
      },
      author: {
        id: message.author.id,
        username: message.author.username || 'Unknown'
      }
    };
  }

  // Method to build context with custom parameters (for testing/preview)
  buildCustomContext(overrides = {}) {
    const settings = storage.getSettings();
    const persona = storage.getPersona();
    const llmSettings = storage.getLLMSettings();

    return {
      systemPrompt: llmSettings.systemPrompt || settings.systemPrompt,
      characterName: persona.name || 'Bot', // FIX: Add fallback
      characterDescription: persona.description || '', // FIX: Add fallback
      exampleMessages: persona.mes_example || '', // FIX: Add fallback
      conversationHistory: [],
      llmSettings: llmSettings,
      ...overrides
    };
  }

  // Method to get context summary for logging
  getContextSummary(context) {
    return {
      characterName: context.characterName || 'Unknown',
      hasSystemPrompt: !!context.systemPrompt,
      hasDescription: !!context.characterDescription,
      hasExamples: !!context.exampleMessages,
      historyLength: context.conversationHistory?.length || 0,
      contextLimit: context.llmSettings?.context_limit || 4096,
      maxCharacters: context.llmSettings?.max_characters || 2000
    };
  }
}

module.exports = ResponseContextBuilder;