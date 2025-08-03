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

  async executeRespond(message) {
    try {
      // Add realistic typing delay
      await this.typingSimulator.simulateTyping(message.channel);
      
      // Generate full response using existing system (normal send)
      const result = await this.responseGenerator.generateResponse(message);
      
      if (result.success) {
        // Use normal channel.send instead of reply
        const response = await message.channel.send(result.response);
        
        // Add bot response to conversation history
        this.conversationManager.addMessage(response, true);
        
        logger.success('Response action completed (normal send)', {
          source: 'discord',
          channel: message.channel.name,
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
        channel: message.channel.name
      });
      return { success: false, error: error.message };
    }
  }

  async executeReply(message) {
    try {
      // Add realistic typing delay
      await this.typingSimulator.simulateTyping(message.channel);
      
      // Generate full response using existing system (Discord reply)
      const result = await this.responseGenerator.generateResponse(message);
      
      if (result.success) {
        // Use Discord's reply function to create visual connection
        const response = await message.reply(result.response);
        
        // Add bot response to conversation history
        this.conversationManager.addMessage(response, true);
        
        logger.success('Reply action completed (Discord reply)', {
          source: 'discord',
          channel: message.channel.name,
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
        channel: message.channel.name
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = ResponseAction;