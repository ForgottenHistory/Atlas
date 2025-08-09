const ResponseGenerator = require('../response/ResponseGenerator');
const TypingSimulator = require('./TypingSimulator');
const logger = require('../../logger/Logger');

class ResponseAction {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    this.responseGenerator = new ResponseGenerator(conversationManager);
    this.typingSimulator = new TypingSimulator();
  }

  async executeRespond(message, decision = null) {
    try {
      // Add realistic typing delay
      await this.typingSimulator.simulateTyping(message.channel);

      // Generate full response using existing system (normal send)
      const result = await this.responseGenerator.generateResponse(message);

      if (result.success) {
        // FIXED: Pass decision context to ensure correct send vs reply behavior
        const fakeDecision = { action: 'respond' }; // Force normal send
        const response = await this.sendResponseWithDecision(message, result, fakeDecision);

        logger.success('Response action completed (normal send)', {
          source: 'discord',
          channel: message.channel?.name || 'Unknown',
          responseLength: result.response.length
        });

        return { success: true, actionType: 'respond', result };
      } else {
        throw new Error(result.error || 'Response generation failed');
      }
    } catch (error) {
      logger.error('Response action failed', {
        source: 'discord',
        error: error.message,
        channel: message.channel?.name || 'Unknown'
      });
      return { success: false, error: error.message };
    }
  }

  async executeReply(message, decision = null) {
    try {
      // Add realistic typing delay
      await this.typingSimulator.simulateTyping(message.channel);

      // Generate full response using existing system (Discord reply)
      const result = await this.responseGenerator.generateResponse(message);

      if (result.success) {
        // FIXED: Pass decision context to ensure correct send vs reply behavior
        const fakeDecision = { action: 'reply' }; // Force Discord reply
        const response = await this.sendResponseWithDecision(message, result, fakeDecision);

        logger.success('Reply action completed (Discord reply)', {
          source: 'discord',
          channel: message.channel?.name || 'Unknown',
          responseLength: result.response.length
        });

        return { success: true, actionType: 'reply', result };
      } else {
        throw new Error(result.error || 'Response generation failed');
      }
    } catch (error) {
      logger.error('Reply action failed', {
        source: 'discord',
        error: error.message,
        channel: message.channel?.name || 'Unknown'
      });
      return { success: false, error: error.message };
    }
  }

  async sendResponseWithDecision(message, result, decision) {
    try {
      if (decision.action === 'reply') {
        // Should now work since we preserved the original Discord.js message
        const response = await message.reply(result.response);
        this.conversationManager.addMessage(response, true);
        return response;
      } else {
        // Normal channel send
        const response = await message.channel.send(result.response);
        this.conversationManager.addMessage(response, true);
        return response;
      }
    } catch (error) {
      logger.error('Failed to send response', {
        source: 'discord',
        error: error.message,
        action: decision.action,
        hasReplyMethod: typeof message.reply === 'function',
        hasChannel: !!message.channel,
        messageId: message.id
      });
      
      // Fallback to normal send if reply fails
      try {
        const response = await message.channel.send(result.response);
        this.conversationManager.addMessage(response, true);
        return response;
      } catch (sendError) {
        throw new Error(`Both reply and send failed: ${error.message}, ${sendError.message}`);
      }
    }
  }
}

module.exports = ResponseAction;