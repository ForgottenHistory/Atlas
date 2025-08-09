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
    // Defensive: ensure message and nested properties exist
    const safeMessage = message || {};
    const safeAuthor = safeMessage.author || {};
    const safeChannelContext = channelContext || {};
    const safePersona = persona || {};

    // Use batched content if available, otherwise use regular content
    const messageContent = safeMessage.batchedContent || safeMessage.content || '';

    return {
      characterName: safePersona.name || 'Atlas',
      characterDescription: safePersona.description || 'A helpful, engaging bot',
      channelName: safeChannelContext.channelName || 'unknown',
      serverName: safeChannelContext.serverName || 'unknown',
      activityLevel: safeChannelContext.activityLevel || 'normal',
      lastAction: safeChannelContext.lastAction || 'none',
      timeSinceLastAction: this.getTimeSinceLastAction(safeChannelContext),
      authorUsername: safeAuthor.username || 'User',
      messageContent: messageContent
    };
  }

  static buildConversationContext(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return '';
    }

    const recentMessages = conversationHistory.slice(-3);
    const messageLines = recentMessages.map(msg => {
      const author = msg.author || 'Unknown';
      const content = msg.content || '';
      const truncated = content.length > 100 ? content.substring(0, 100) + '...' : content;
      return `${author}: ${truncated}`;
    });

    return `\nRECENT CONVERSATION:\n${messageLines.join('\n')}\n`;
  }

  static buildImageContext(message, channelContext) {
    // Defensive: ensure message and channelContext exist
    const safeMessage = message || {};
    const safeChannelContext = channelContext || {};
    
    if (!safeChannelContext.hasImages || !safeMessage.imageAnalysis) {
      return '';
    }

    const analyses = Array.isArray(safeMessage.imageAnalysis) 
      ? safeMessage.imageAnalysis 
      : [safeMessage.imageAnalysis];
    
    const imageLines = analyses.map((analysis, index) => 
      `Image ${index + 1}: ${analysis.analysis ? analysis.analysis.substring(0, 200) + '...' : 'No analysis available'}`
    );

    return `\nIMAGES SHARED:\n${imageLines.join('\n')}\n`;
  }

  static buildToolResults(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return '';
    }

    const resultLines = toolResults.map((result, index) => {
      const tool = result.tool || 'unknown';
      const summary = result.summary || result.data || 'No result';
      return `${index + 1}. ${tool}: ${summary}`;
    });

    return `\nTOOL RESULTS:\n${resultLines.join('\n')}\n`;
  }

  static buildActionHistory(previousActions) {
    if (!previousActions || previousActions.length === 0) {
      return '';
    }

    const actionLines = previousActions.map((action, index) => {
      const actionType = action.action || 'unknown';
      const reasoning = action.reasoning || 'No reasoning provided';
      return `${index + 1}. ${actionType} - ${reasoning}`;
    });

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