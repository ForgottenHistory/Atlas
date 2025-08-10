const TemplateEngine = require('../prompts/TemplateEngine');
const {
  DEFAULT_SYSTEM_PROMPT,
  CHARACTER_PROMPT_TEMPLATE,
  CHARACTER_IDENTITY_TEMPLATE,
  EXAMPLE_MESSAGES_TEMPLATE,
  CONVERSATION_HISTORY_TEMPLATE,
  REPLY_TO_TEMPLATE
} = require('../prompts/responsePrompts');

/**
 * Handles all response generation prompt building
 * Focused on creating high-quality character responses
 */
class ResponseBuilder {
  
  constructor() {
    this.strictSystemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Build complete character prompt for response generation
   */
  static buildCharacterPrompt(context) {
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
    const systemSection = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const characterSection = this.buildCharacterIdentity(characterName, characterDescription);
    const exampleSection = this.buildExampleMessages(exampleMessages, characterName);

    // Calculate base tokens
    const basePrompt = systemSection + characterSection + exampleSection;
    const baseTokens = TemplateEngine.estimateTokenCount(basePrompt);

    // Build dynamic history with remaining tokens
    const historyTokenBudget = availableTokens - baseTokens;
    const historySection = this.buildDynamicHistory(conversationHistory, historyTokenBudget);
    const replyToSection = this.buildReplyTo(currentMessage);

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

  /**
   * Build character identity section
   */
  static buildCharacterIdentity(name, description) {
    if (!name && !description) return '';
    
    const variables = {
      characterName: name || '',
      characterDescription: description || ''
    };

    return TemplateEngine.substitute(CHARACTER_IDENTITY_TEMPLATE, variables);
  }

  /**
   * Build example messages section
   */
  static buildExampleMessages(exampleMessages, characterName) {
    if (!exampleMessages || !exampleMessages.trim()) return '';

    const examples = this.cleanExampleMessages(exampleMessages);
    const variables = { examples: examples };

    return TemplateEngine.substitute(EXAMPLE_MESSAGES_TEMPLATE, variables);
  }

  /**
   * Build dynamic conversation history with token budget
   */
  static buildDynamicHistory(conversationHistory, tokenBudget) {
    if (!conversationHistory || conversationHistory.length === 0 || tokenBudget <= 0) {
      return '';
    }

    let messages = '';
    let currentTokens = TemplateEngine.estimateTokenCount('## Conversation History:');
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

  /**
   * Build reply-to section for current message
   */
  static buildReplyTo(currentMessage) {
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

  /**
   * Clean example messages format
   */
  static cleanExampleMessages(exampleMessages) {
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

  /**
   * Count messages in history section
   */
  static countMessagesInHistory(historySection) {
    if (!historySection) return 0;
    const lines = historySection.split('\n').filter(line => line.includes(':') && line.trim() !== '');
    return Math.max(0, lines.length - 1);
  }

  /**
   * Validate response prompt context
   */
  static validateContext(context) {
    const errors = [];

    if (!context.characterName) {
      errors.push('Character name is required');
    }

    if (!context.conversationHistory) {
      errors.push('Conversation history is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate token limits for prompt
   */
  static validateTokenLimits(context) {
    const result = this.buildCharacterPrompt(context);
    
    const validation = {
      valid: true,
      warnings: [],
      metadata: result.metadata
    };

    // Check if prompt is too long
    if (result.metadata.totalTokens > result.metadata.contextLimit) {
      validation.valid = false;
      validation.warnings.push('Prompt exceeds context limit');
    }

    // Check if history was truncated significantly
    if (context.conversationHistory?.length > 0 && result.metadata.messagesIncluded === 0) {
      validation.warnings.push('No conversation history could be included due to token limits');
    }

    // Check token efficiency
    const historyRatio = result.metadata.historyTokens / result.metadata.totalTokens;
    if (historyRatio < 0.3) {
      validation.warnings.push('Low conversation history ratio - consider reducing base prompt size');
    }

    return validation;
  }

  /**
   * Get optimal token distribution for context
   */
  static getOptimalTokenDistribution(contextLimit) {
    return {
      system: Math.ceil(contextLimit * 0.15),      // 15% for system prompt
      character: Math.ceil(contextLimit * 0.10),   // 10% for character identity
      examples: Math.ceil(contextLimit * 0.15),    // 15% for examples
      history: Math.ceil(contextLimit * 0.50),     // 50% for conversation history
      buffer: Math.ceil(contextLimit * 0.10)       // 10% safety buffer
    };
  }

  /**
   * Build optimized prompt with token distribution
   */
  static buildOptimizedPrompt(context) {
    const contextLimit = context.llmSettings?.context_limit || 4096;
    const distribution = this.getOptimalTokenDistribution(contextLimit);
    
    // Build sections with token limits
    const optimizedContext = {
      ...context,
      tokenLimits: distribution
    };

    return this.buildCharacterPrompt(optimizedContext);
  }
}

module.exports = ResponseBuilder;