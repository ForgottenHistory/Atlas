const logger = require('../logger/Logger');
const ResponseGenerator = require('./response/ResponseGenerator');

class ActionExecutor {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    this.responseGenerator = new ResponseGenerator(conversationManager);
    
    logger.info('ActionExecutor initialized', {
      source: 'discord',
      supportedActions: ['respond', 'react', 'ignore', 'status_change', 'typing']
    });
  }

async executeAction(decision, message) {
    try {
      logger.info('Executing bot action', {
        source: 'discord',
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        channel: message.channel.name,
        server: message.guild?.name || 'DM'
      });

      switch (decision.action) {
        case 'respond':
          return await this.executeRespond(message);
          
        case 'reply':
          return await this.executeReply(message);
          
        case 'react':
          return await this.executeReact(message, decision.emoji);
          
        case 'ignore':
          return await this.executeIgnore(message, decision.reasoning);
          
        case 'status_change':
          return await this.executeStatusChange(decision.status);
          
        default:
          logger.warn('Unknown action type', {
            source: 'discord',
            action: decision.action
          });
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      logger.error('Action execution failed', {
        source: 'discord',
        action: decision.action,
        error: error.message,
        channel: message.channel.name
      });
      return { success: false, error: error.message };
    }
  }

  async executeRespond(message) {
    try {
      // Add realistic typing delay
      await this.simulateTyping(message.channel);
      
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
      await this.simulateTyping(message.channel);
      
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

  async executeReact(message, emoji) {
    try {
      if (!emoji) {
        // Default emoji if none specified
        emoji = this.getContextualEmoji(message.content);
      }
      
      await message.react(emoji);
      
      logger.success('React action completed', {
        source: 'discord',
        emoji: emoji,
        channel: message.channel.name,
        messageContent: message.content.substring(0, 50)
      });
      
      return { success: true, actionType: 'react', emoji };
    } catch (error) {
      logger.error('React action failed', {
        source: 'discord',
        error: error.message,
        emoji: emoji,
        channel: message.channel.name
      });
      return { success: false, error: error.message };
    }
  }

  async executeIgnore(message, reasoning) {
    logger.debug('Ignore action executed', {
      source: 'discord',
      reasoning: reasoning,
      channel: message.channel.name,
      author: message.author.username
    });
    
    return { success: true, actionType: 'ignore', reasoning };
  }

  async executeStatusChange(status) {
    try {
      const client = this.discordClient.client?.client || this.discordClient.client?.getClient?.();
      
      if (!client || !client.user) {
        throw new Error('Discord client not available');
      }

      // Map status strings to Discord presence status
      const statusMap = {
        'online': 'online',
        'away': 'idle', 
        'dnd': 'dnd',
        'invisible': 'invisible'
      };

      const discordStatus = statusMap[status] || 'online';
      
      await client.user.setPresence({
        status: discordStatus,
        activities: []
      });
      
      logger.success('Status change action completed', {
        source: 'discord',
        newStatus: status,
        discordStatus: discordStatus
      });
      
      return { success: true, actionType: 'status_change', status };
    } catch (error) {
      logger.error('Status change action failed', {
        source: 'discord',
        error: error.message,
        requestedStatus: status
      });
      return { success: false, error: error.message };
    }
  }

  async simulateTyping(channel, durationMs = null) {
    try {
      // Realistic typing duration based on response length estimate
      const duration = durationMs || this.calculateTypingDuration();
      
      await channel.sendTyping();
      
      // Keep typing indicator alive for the duration
      if (duration > 5000) {
        const intervals = Math.floor(duration / 5000);
        for (let i = 0; i < intervals; i++) {
          setTimeout(() => {
            channel.sendTyping().catch(() => {}); // Silent fail
          }, (i + 1) * 5000);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, duration));
      
      logger.debug('Typing simulation completed', {
        source: 'discord',
        duration: duration,
        channel: channel.name
      });
    } catch (error) {
      logger.warn('Typing simulation failed', {
        source: 'discord',
        error: error.message
      });
    }
  }

  calculateTypingDuration() {
    // Simulate realistic human typing speed
    // Average: 40 WPM = ~200 characters per minute = ~3.3 chars/second
    const estimatedResponseLength = 50 + Math.random() * 150; // 50-200 chars
    const typingSpeed = 3 + Math.random() * 2; // 3-5 chars/second
    const baseDuration = (estimatedResponseLength / typingSpeed) * 1000;
    
    // Add some human variation (pauses, thinking)
    const humanVariation = 1000 + Math.random() * 2000; // 1-3 second thinking pause
    
    return Math.min(baseDuration + humanVariation, 8000); // Max 8 seconds
  }

  getContextualEmoji(messageContent) {
    const content = messageContent.toLowerCase();
    
    // Simple contextual emoji mapping
    if (content.includes('funny') || content.includes('lol') || content.includes('haha')) {
      return '😂';
    }
    if (content.includes('good') || content.includes('great') || content.includes('awesome')) {
      return '👍';
    }
    if (content.includes('sad') || content.includes('sorry')) {
      return '😢';
    }
    if (content.includes('wow') || content.includes('amazing')) {
      return '😮';
    }
    if (content.includes('love') || content.includes('heart')) {
      return '❤️';
    }
    if (content.includes('question') || content.includes('?')) {
      return '🤔';
    }
    
    // Default reactions
    const defaultEmojis = ['👍', '😊', '🤔', '😮', '✨'];
    return defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
  }

  // Utility method to check if bot can perform actions in channel
  canActInChannel(channel) {
    try {
      const client = this.discordClient.client?.client || this.discordClient.client?.getClient?.();
      if (!client || !channel.guild) return true; // DM channels
      
      const botMember = channel.guild.members.cache.get(client.user.id);
      if (!botMember) return false;
      
      const permissions = botMember.permissionsIn(channel);
      
      return permissions.has('SendMessages') && 
             permissions.has('ReadMessageHistory') && 
             permissions.has('AddReactions');
    } catch (error) {
      logger.warn('Permission check failed', {
        source: 'discord',
        error: error.message,
        channel: channel.name
      });
      return false;
    }
  }
}

module.exports = ActionExecutor;