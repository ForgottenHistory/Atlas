class ContextAnalyzer {
  analyzeContext(context) {
    const { message, channel, conversationHistory, hasImages } = context;
    
    return {
      channelName: channel.name,
      serverName: channel.guild?.name || 'DM',
      hasImages: hasImages || false,
      imageAnalysis: message.imageAnalysis || null,
      conversationHistory: conversationHistory || [],
      lastAction: 'none', // Could be enhanced with actual last action tracking
      activityLevel: this.analyzeActivityLevel(conversationHistory),
      messageContext: this.analyzeMessageContext(message, conversationHistory)
    };
  }

  analyzeActivityLevel(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return 'quiet';
    }
    
    // Analyze recent activity (last 10 messages)
    const recentMessages = conversationHistory.slice(-10);
    const timeWindow = 300000; // 5 minutes
    const now = new Date();
    
    const recentActivity = recentMessages.filter(msg => {
      const messageTime = new Date(msg.timestamp);
      return (now - messageTime) < timeWindow;
    });
    
    if (recentActivity.length > 5) return 'very_active';
    if (recentActivity.length > 2) return 'active';
    if (recentActivity.length > 0) return 'normal';
    return 'quiet';
  }

  analyzeMessageContext(message, conversationHistory) {
    const context = {
      isQuestion: this.containsQuestion(message.content),
      mentionsBot: this.mentionsBot(message.content),
      isGreeting: this.isGreeting(message.content),
      hasImages: !!message.imageAnalysis,
      followsUpPrevious: this.followsUpPrevious(message, conversationHistory),
      sentiment: this.analyzeSentiment(message.content)
    };
    
    return context;
  }

  containsQuestion(content) {
    if (!content) return false;
    
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'should'];
    const lowerContent = content.toLowerCase();
    
    return content.includes('?') || 
           questionWords.some(word => lowerContent.includes(word));
  }

  mentionsBot(content) {
    if (!content) return false;
    
    // This would be enhanced to check for actual bot mentions
    // For now, check for common bot-directed phrases
    const botKeywords = ['bot', 'atlas', 'hey', 'hello'];
    const lowerContent = content.toLowerCase();
    
    return botKeywords.some(keyword => lowerContent.includes(keyword));
  }

  isGreeting(content) {
    if (!content) return false;
    
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'whats up', "what's up"];
    const lowerContent = content.toLowerCase();
    
    return greetings.some(greeting => lowerContent.includes(greeting));
  }

  followsUpPrevious(message, conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) return false;
    
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (!lastMessage || lastMessage.author === message.author.username) return false;
    
    // Simple check if this message seems to respond to the previous one
    const timeDiff = new Date(message.timestamp || new Date()) - new Date(lastMessage.timestamp);
    return timeDiff < 60000; // Within 1 minute
  }

  analyzeSentiment(content) {
    if (!content) return 'neutral';
    
    const positiveWords = ['good', 'great', 'awesome', 'amazing', 'love', 'like', 'happy', 'excellent', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'disappointed'];
    
    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  buildChannelAnalysisContext(recentMessages, channelInfo) {
    const messagesSummary = recentMessages.slice(0, 5).map(msg => {
      let summary = `${msg.author}: ${msg.content.substring(0, 100)}`;
      if (msg.imageAnalysis) {
        summary += ' [shared image]';
      }
      return summary;
    }).join('\n');

    return {
      channelName: channelInfo.channelName,
      serverName: channelInfo.serverName,
      messagesSummary,
      activityLevel: this.analyzeActivityLevel(recentMessages),
      hasImages: recentMessages.some(msg => msg.imageAnalysis),
      participantCount: new Set(recentMessages.map(msg => msg.author)).size
    };
  }

  getContextSummary(context) {
    const analysis = this.analyzeContext(context);
    
    return {
      channel: `${analysis.channelName} in ${analysis.serverName}`,
      activity: analysis.activityLevel,
      hasImages: analysis.hasImages,
      messageType: this.categorizeMessage(analysis.messageContext),
      conversationLength: analysis.conversationHistory.length,
      shouldEngage: this.shouldEngageBasedOnContext(analysis)
    };
  }

  categorizeMessage(messageContext) {
    if (messageContext.isQuestion) return 'question';
    if (messageContext.mentionsBot) return 'mention';
    if (messageContext.isGreeting) return 'greeting';
    if (messageContext.hasImages) return 'image_share';
    if (messageContext.followsUpPrevious) return 'followup';
    return 'general';
  }

  shouldEngageBasedOnContext(analysis) {
    // Basic heuristics for engagement
    const messageContext = analysis.messageContext;
    
    if (messageContext.isQuestion || messageContext.mentionsBot) return 'high';
    if (messageContext.hasImages || messageContext.isGreeting) return 'medium';
    if (analysis.activityLevel === 'very_active') return 'low';
    if (analysis.activityLevel === 'quiet') return 'medium';
    return 'low';
  }
}

module.exports = ContextAnalyzer;