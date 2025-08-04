const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');

class ResponseProcessor {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
  }

  async handleSuccessfulResponse(message, result, context, decision = null) {
    // Log detailed token usage
    this.logTokenUsage(result, context, message.channel.name);

    // Log truncation warnings
    this.logTruncationWarnings(result, message.channel.name);

    // FIXED: Use the decision's action preference if available
    // This preserves the bot's original intent (respond vs reply)
    let response;
    try {
      const shouldUseReply = this.shouldUseReplyForMessage(message, decision);

      logger.info('Reply decision made', {
        source: 'discord',
        shouldUseReply: shouldUseReply,
        decisionAction: decision?.action || 'unknown',
        channel: message.channel.name,
        messageId: message.id
      });

      if (shouldUseReply) {
        response = await message.reply(result.response);
        logger.debug('Used Discord reply function', {
          source: 'discord',
          channel: message.channel.name,
          messageId: message.id
        });
      } else {
        response = await message.channel.send(result.response);
        logger.debug('Used normal send instead of reply', {
          source: 'discord',
          channel: message.channel.name,
          reason: 'decision_was_respond_not_reply'
        });
      }
    } catch (error) {
      // Fallback to normal send if reply fails
      logger.warn('Reply failed, falling back to send', {
        source: 'discord',
        error: error.message,
        channel: message.channel.name
      });
      response = await message.channel.send(result.response);
    }

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

  /**
   * Determine reply vs send based on the decision engine's choice
   * This preserves the bot's original intent while being reliable
   */
  shouldUseReplyForMessage(message, decision) {
    // If we have a decision from the decision engine, use its preference
    if (decision && decision.action) {
      return decision.action === 'reply';
    }

    // Fallback logic if no decision available
    // Use reply for direct engagement, send for casual conversation
    const messageAge = Date.now() - message.createdTimestamp;
    const isRecent = messageAge < 60000; // 1 minute

    return isRecent;
  }

  /**
   * Simplified, reliable logic for determining reply vs send
   * Based on message characteristics rather than fetching new data
   */
  shouldUseReplyForMessage(message) {
    // Always use reply - let Discord handle the visual connection
    // This is more reliable than trying to guess channel state
    return true;

    // Alternative: Use message age as a factor
    // const messageAge = Date.now() - message.createdTimestamp;
    // const isRecent = messageAge < 30000; // 30 seconds
    // return isRecent;
  }

  /**
   * Determine if we should use Discord's reply function or just send normally
   * @param {Object} message - The message we're responding to
   * @returns {boolean} - True if we should use reply, false for normal send
   */
  async shouldUseReply(message) {
    logger.debug('shouldUseReply method called', {
      source: 'discord',
      messageId: message.id,
      channel: message.channel.name,
      author: message.author.username
    });

    try {
      // Fetch recent messages to check if user's message is the latest
      logger.debug('Fetching recent messages to check position', {
        source: 'discord',
        channel: message.channel.name
      });

      const lastMessages = await message.channel.messages.fetch({ limit: 5 });
      const messagesArray = Array.from(lastMessages.values())
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

      logger.debug('Fetched messages for analysis', {
        source: 'discord',
        messagesCount: messagesArray.length,
        channel: message.channel.name,
        messageIds: messagesArray.map(m => ({ id: m.id, author: m.author.username }))
      });

      // Find the message we're responding to
      const messageIndex = messagesArray.findIndex(msg => msg.id === message.id);

      logger.debug('Message position analysis', {
        source: 'discord',
        targetMessageId: message.id,
        messageIndex: messageIndex,
        isLatest: messageIndex === 0
      });

      // If we can't find the message or it's not the most recent, use reply
      if (messageIndex !== 0) {
        logger.debug('Message is not the latest, using reply', {
          source: 'discord',
          messageIndex: messageIndex,
          channel: message.channel.name
        });
        return true;
      }

      // If this is the most recent message, check if there are other recent messages
      // Don't use reply if this message is clearly part of a recent conversation flow
      if (messagesArray.length >= 2) {
        const currentMessage = messagesArray[0]; // The user's message we're responding to
        const previousMessage = messagesArray[1]; // Message before it

        const timeDifference = currentMessage.createdTimestamp - previousMessage.createdTimestamp;
        const isRecentFlow = timeDifference < 60000; // Within 1 minute

        logger.debug('Time difference analysis', {
          source: 'discord',
          timeDifference: timeDifference,
          isRecentFlow: isRecentFlow,
          threshold: 60000,
          previousAuthor: previousMessage.author.username,
          currentAuthor: currentMessage.author.username
        });

        if (isRecentFlow) {
          logger.debug('Message is part of recent conversation flow, skipping reply', {
            source: 'discord',
            timeDifference: timeDifference,
            previousAuthor: previousMessage.author.username,
            currentAuthor: currentMessage.author.username,
            channel: message.channel.name
          });
          return false; // Use normal send
        }
      }

      // For standalone messages or old conversations, use reply
      logger.debug('Using reply for standalone or old message', {
        source: 'discord',
        channel: message.channel.name
      });
      return true;

    } catch (error) {
      logger.warn('Error checking message position, defaulting to reply', {
        source: 'discord',
        error: error.message
      });
      return true; // Default to reply if we can't check
    }
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