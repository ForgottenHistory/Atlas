const storage = require('../../../utils/storage');
const TemplateEngine = require('../prompts/TemplateEngine');
const { 
  QUICK_DECISION_TEMPLATE,
  TOOL_ENHANCED_DECISION_TEMPLATE,
  BATCH_DECISION_TEMPLATE,
  CHANNEL_ANALYSIS_TEMPLATE
} = require('../prompts/decisionPrompts');

const {
  DEFAULT_SYSTEM_PROMPT,
  CHARACTER_PROMPT_TEMPLATE,
  CHARACTER_IDENTITY_TEMPLATE,
  EXAMPLE_MESSAGES_TEMPLATE,
  CONVERSATION_HISTORY_TEMPLATE,
  REPLY_TO_TEMPLATE
} = require('../prompts/responsePrompts');

class PromptBuilder {
  constructor() {
    this.strictSystemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  // === DECISION PROMPTS ===

  buildQuickDecisionPrompt(message, channelContext) {
    const persona = storage.getPersona();
    const variables = {
      ...TemplateEngine.buildContextVariables(message, channelContext, persona),
      conversationContext: TemplateEngine.buildConversationContext(channelContext.conversationHistory),
      imageContext: TemplateEngine.buildImageContext(message, channelContext)
    };

    return TemplateEngine.substitute(QUICK_DECISION_TEMPLATE, variables);
  }

  buildToolDecisionPrompt(message, channelContext, toolResults, previousActions) {
    const persona = storage.getPersona();
    const variables = {
      ...TemplateEngine.buildContextVariables(message, channelContext, persona),
      conversationContext: TemplateEngine.buildConversationContext(channelContext.conversationHistory),
      imageContext: TemplateEngine.buildImageContext(message, channelContext),
      toolResults: TemplateEngine.buildToolResults(toolResults),
      actionHistory: TemplateEngine.buildActionHistory(previousActions)
    };

    return TemplateEngine.substitute(TOOL_ENHANCED_DECISION_TEMPLATE, variables);
  }

  buildChannelAnalysisPrompt(analysisContext) {
    const persona = storage.getPersona();
    const variables = {
      characterName: persona.name || 'Atlas',
      channelName: analysisContext.channelName || 'unknown',
      serverName: analysisContext.serverName || 'unknown',
      activityLevel: analysisContext.activityLevel || 'normal',
      participantCount: analysisContext.participantCount || 0,
      messagesSummary: analysisContext.messagesSummary || 'No recent messages'
    };

    return TemplateEngine.substitute(CHANNEL_ANALYSIS_TEMPLATE, variables);
  }

  buildBatchDecisionPrompt(messages, context) {
    const persona = storage.getPersona();
    const messageList = messages.map((msg, index) => 
      `${index + 1}. ${msg.author.username}: "${msg.content}"`
    ).join('\n');

    const variables = {
      characterName: persona.name || 'Atlas',
      channelName: context.channelName || 'unknown',
      serverName: context.serverName || 'unknown',
      activityLevel: context.activityLevel || 'normal',
      messageList: messageList
    };

    return TemplateEngine.substitute(BATCH_DECISION_TEMPLATE, variables);
  }

  // === RESPONSE GENERATION PROMPTS ===

  buildCharacterPrompt(context) {
    const {
      systemPrompt,
      characterName,
      characterDescription,
      exampleMessages,
      conversationHistory = [],
      llmSettings = {},
      currentMessage
    } = context;

    // Get token limits
    const contextLimit = llmSettings.context_limit || 4096;
    const safetyBuffer = Math.ceil(contextLimit * 0.1);
    const availableTokens = contextLimit - safetyBuffer;

    // Build sections
    const systemSection = systemPrompt || this.strictSystemPrompt;
    const characterSection = this.buildCharacterIdentitySection(characterName, characterDescription);
    const exampleSection = this.buildExampleMessagesSection(exampleMessages, characterName);

    // Calculate base tokens
    const basePrompt = systemSection + characterSection + exampleSection;
    const baseTokens = TemplateEngine.estimateTokenCount(basePrompt);

    // Build dynamic history with remaining tokens
    const historyTokenBudget = availableTokens - baseTokens;
    const historySection = this.buildDynamicHistorySection(conversationHistory, historyTokenBudget);
    const replyToSection = this.buildReplyToSection(currentMessage);

    // Assemble final prompt
    const variables = {
      systemPrompt: systemSection + '\n\n',
      characterIdentity: characterSection,
      exampleMessages: exampleSection,
      conversationHistory: historySection,
      replyToSection: replyToSection,
      characterName: characterName || ''
    };

    const finalPrompt = TemplateEngine.substitute(CHARACTER_PROMPT_TEMPLATE, variables);

    return {
      prompt: finalPrompt,
      metadata: {
        totalTokens: TemplateEngine.estimateTokenCount(finalPrompt),
        baseTokens: baseTokens,
        historyTokens: TemplateEngine.estimateTokenCount(historySection),
        availableTokens: availableTokens,
        contextLimit: contextLimit,
        safetyBuffer: safetyBuffer,
        messagesIncluded: this.countMessagesInHistory(historySection)
      }
    };
  }

  // === HELPER METHODS ===

  buildCharacterIdentitySection(name, description) {
    if (!name && !description) return '';
    
    const variables = {
      characterName: name || '',
      characterDescription: description || ''
    };

    return TemplateEngine.substitute(CHARACTER_IDENTITY_TEMPLATE, variables);
  }

  buildExampleMessagesSection(exampleMessages, characterName) {
    if (!exampleMessages || !exampleMessages.trim()) return '';

    const examples = this.cleanExampleMessages(exampleMessages);
    const variables = { examples: examples };

    return TemplateEngine.substitute(EXAMPLE_MESSAGES_TEMPLATE, variables);
  }

  buildDynamicHistorySection(conversationHistory, tokenBudget) {
    if (!conversationHistory || conversationHistory.length === 0 || tokenBudget <= 0) {
      return '';
    }

    let messages = '';
    let currentTokens = TemplateEngine.estimateTokenCount('## Conversation History:\n');
    let includedMessages = 0;

    for (const message of conversationHistory) {
      let messageText = `${message.author || 'User'}: ${message.content || ''}\n`;

      // Add image analysis if present
      if (message.imageAnalysis && Array.isArray(message.imageAnalysis)) {
        const imageContext = message.imageAnalysis.map(analysis =>
          `[Image: ${analysis.analysis.substring(0, 200)}...]`
        ).join(' ');
        messageText = `${message.author || 'User'}: ${message.content || ''} ${imageContext}\n`;
      }

      const messageTokens = TemplateEngine.estimateTokenCount(messageText);

      if (currentTokens + messageTokens > tokenBudget) {
        break;
      }

      messages += messageText;
      currentTokens += messageTokens;
      includedMessages++;
    }

    if (includedMessages === 0) return '';

    const variables = { messages: messages };
    return TemplateEngine.substitute(CONVERSATION_HISTORY_TEMPLATE, variables);
  }

  buildReplyToSection(currentMessage) {
    if (!currentMessage) return '';

    // Use batched content if available, otherwise use regular content
    let messageContent = currentMessage.batchedContent || currentMessage.content || '';

    if (currentMessage.imageAnalysis && Array.isArray(currentMessage.imageAnalysis)) {
      const imageContext = currentMessage.imageAnalysis.map(analysis =>
        `[Image: ${analysis.analysis.substring(0, 100)}...]`
      ).join(' ');
      messageContent = `${messageContent} ${imageContext}`.trim();
    }

    const variables = {
      authorUsername: currentMessage.author?.username || 'User',
      messageContent: messageContent
    };

    return TemplateEngine.substitute(REPLY_TO_TEMPLATE, variables);
  }

  cleanExampleMessages(exampleMessages) {
    const lines = exampleMessages.trim().split('\n').filter(line => line.trim());
    const cleanedExamples = [];

    lines.forEach(line => {
      let cleaned = line.trim()
        .replace(/^[A-Za-z\s]*\([^)]*\):\s*/gi, '') // Remove "Name (emotion):"
        .replace(/^[A-Za-z\s]*:\s*/gi, '') // Remove "Name:"
        .replace(/\*[^*]*\*/g, '') // Remove *actions*
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .trim();

      if (cleaned) {
        cleanedExamples.push(`Example: ${cleaned}`);
      }
    });

    return cleanedExamples.join('\n') + '\n';
  }

  countMessagesInHistory(historySection) {
    if (!historySection) return 0;
    const lines = historySection.split('\n').filter(line => line.includes(':') && line.trim() !== '');
    return Math.max(0, lines.length - 1);
  }

  // === UTILITY METHODS ===

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

  // === MISSING PROMPT METHODS ===

  buildAggressiveDecisionPrompt(message, channelContext) {
    // More aggressive version with higher engagement threshold
    const prompt = this.buildQuickDecisionPrompt(message, channelContext);
    return prompt.replace(
      'Don\'t respond to every message (be selective like a human)',
      'Be more willing to engage in conversation and respond actively'
    );
  }

  buildImageFocusedDecisionPrompt(message, channelContext) {
    // Image-focused decision making
    const prompt = this.buildQuickDecisionPrompt(message, channelContext);
    return prompt.replace(
      'Images often warrant some kind of response or reaction',
      'Images shared deserve attention - prioritize reacting or commenting on visual content'
    );
  }

  timeSinceLastAction() {
    return TemplateEngine.getTimeSinceLastAction({});
  }
}

module.exports = PromptBuilder;