const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');

class ResponseProcessor {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
  }

  async handleSuccessfulResponse(message, result, context) {
    // Log detailed token usage
    this.logTokenUsage(result, context, message.channel.name);

    // Log truncation warnings
    this.logTruncationWarnings(result, message.channel.name);

    // Send the response
    const response = await message.reply(result.response);
    
    logger.success('AI response sent successfully', {
      source: 'llm',
      character: context.characterName || 'Bot',
      responseLength: result.response.length,
      channel: message.channel.name,
      tokenUsage: result.metadata?.tokenUsage,
      wasTruncated: result.metadata?.truncationInfo?.wasTruncated || false
    });
    
    // Add bot response to conversation history
    this.conversationManager.addMessage(response, true);
    
    // Log activity with detailed context info
    const activityMessage = this.buildActivityMessage(message, result, context);
    await storage.addActivity(activityMessage);

    return response;
  }

  async handleFailedResponse(message, result) {
    logger.error('LLM generation failed', {
      source: 'llm',
      error: result.error,
      channel: message.channel.name,
      fallbackUsed: !!result.fallbackResponse
    });
    
    // Use fallback response
    const fallback = result.fallbackResponse || 'Hi! 👋';
    await message.reply(fallback);
    
    await storage.addActivity(`Fallback response used in #${message.channel.name} (LLM error: ${result.error})`);
  }

  async sendFallbackResponse(message) {
    try {
      await message.reply('Hi! 👋');
      await storage.addActivity(`Emergency fallback response used in #${message.channel.name}`);
    } catch (error) {
      logger.error('Failed to send fallback response', {
        source: 'discord',
        error: error.message,
        channel: message.channel.name
      });
    }
  }

  logTokenUsage(result, context, channelName) {
    if (result.metadata?.tokenUsage) {
      logger.info('Token usage details', {
        source: 'llm',
        tokenUsage: result.metadata.tokenUsage,
        messagesIncluded: result.metadata.tokenUsage.messagesIncluded || 0,
        totalAvailable: context.conversationHistory.length,
        channel: channelName,
        efficiency: `${result.metadata.tokenUsage.messagesIncluded}/${context.conversationHistory.length} messages used`
      });
    }
  }

  logTruncationWarnings(result, channelName) {
    if (result.metadata?.truncationInfo?.wasTruncated) {
      logger.warn('Response was truncated', {
        source: 'llm',
        truncationInfo: result.metadata.truncationInfo,
        channel: channelName,
        originalLength: result.metadata.truncationInfo.originalLength,
        finalLength: result.metadata.truncationInfo.finalLength,
        truncationPercentage: result.metadata.truncationInfo.truncationPercentage
      });
    }
  }

  buildActivityMessage(message, result, context) {
    const parts = [`AI response generated in #${message.channel.name}`];
    
    if (result.metadata?.tokenUsage) {
      const { messagesIncluded } = result.metadata.tokenUsage;
      const totalMessages = context.conversationHistory.length;
      parts.push(`(${messagesIncluded}/${totalMessages} messages in context)`);
    }
    
    if (result.metadata?.truncationInfo?.wasTruncated) {
      const { truncationPercentage } = result.metadata.truncationInfo;
      parts.push(`[truncated ${truncationPercentage}%]`);
    }
    
    return parts.join(' ');
  }
}

module.exports = ResponseProcessor;