class TemplateEngine {
  static substitute(template, variables) {
    let result = template;
    
    // Replace all variables in format {variableName}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      const replacement = value !== undefined && value !== null ? String(value) : '';
      result = result.split(placeholder).join(replacement);
    }
    
    return result;
  }

  static buildContextVariables(message, channelContext, persona) {
    return {
      characterName: persona.name || 'Atlas',
      characterDescription: persona.description || 'A helpful, engaging bot',
      channelName: channelContext.channelName || 'unknown',
      serverName: channelContext.serverName || 'unknown',
      activityLevel: channelContext.activityLevel || 'normal',
      lastAction: channelContext.lastAction || 'none',
      timeSinceLastAction: this.getTimeSinceLastAction(channelContext),
      authorUsername: message.author.username || 'User',
      messageContent: message.content || ''
    };
  }

  static buildConversationContext(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return '';
    }

    const recentMessages = conversationHistory.slice(-3);
    const messageLines = recentMessages.map(msg => 
      `${msg.author}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
    );

    return `\nRECENT CONVERSATION:\n${messageLines.join('\n')}\n`;
  }

  static buildImageContext(message, channelContext) {
    if (!channelContext.hasImages || !message.imageAnalysis) {
      return '';
    }

    const analyses = Array.isArray(message.imageAnalysis) 
      ? message.imageAnalysis 
      : [message.imageAnalysis];
    
    const imageLines = analyses.map((analysis, index) => 
      `Image ${index + 1}: ${analysis.analysis.substring(0, 200)}...`
    );

    return `\nIMAGES SHARED:\n${imageLines.join('\n')}\n`;
  }

  static buildToolResults(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return '';
    }

    const resultLines = toolResults.map((result, index) => 
      `${index + 1}. ${result.tool}: ${result.summary || result.data}`
    );

    return `\nTOOL RESULTS:\n${resultLines.join('\n')}\n`;
  }

  static buildActionHistory(previousActions) {
    if (!previousActions || previousActions.length === 0) {
      return '';
    }

    const actionLines = previousActions.map((action, index) => 
      `${index + 1}. ${action.action} - ${action.reasoning}`
    );

    return `\nPREVIOUS ACTIONS IN THIS CHAIN:\n${actionLines.join('\n')}\n`;
  }

  static getTimeSinceLastAction(channelContext) {
    // This should be implemented based on your actual timing logic
    return '5 minutes';
  }

  static estimateTokenCount(text) {
    if (!text) return 0;

    // Simple token estimation: ~4 characters per token for English
    const normalized = text.replace(/\s+/g, ' ').trim();
    const baseTokens = Math.ceil(normalized.length / 4);
    
    // Add tokens for punctuation
    const punctuationCount = (normalized.match(/[.,!?;:()[\]{}'"]/g) || []).length;
    const specialTokens = Math.ceil(punctuationCount * 0.2);

    return baseTokens + specialTokens;
  }
}

module.exports = TemplateEngine;