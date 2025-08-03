const logger = require('../../logger/Logger');

class ActionValidator {
  constructor(discordClient) {
    this.discordClient = discordClient;
  }

  validateAction(decision, message) {
    // Basic validation
    if (!decision || !decision.action) {
      return {
        canExecute: false,
        reason: 'Invalid decision object'
      };
    }

    if (!message || !message.channel) {
      return {
        canExecute: false,
        reason: 'Invalid message object'
      };
    }

    // Check if bot can act in this channel
    if (!this.canActInChannel(message.channel)) {
      return {
        canExecute: false,
        reason: 'Bot lacks permissions in this channel'
      };
    }

    // Action-specific validation
    switch (decision.action) {
      case 'respond':
      case 'reply':
        return this.validateResponseAction(message);
        
      case 'react':
        return this.validateReactionAction(message, decision.emoji);
        
      case 'status_change':
        return this.validateStatusAction(decision.status);
        
      case 'ignore':
        // Always valid
        return { canExecute: true };
        
      default:
        return {
          canExecute: false,
          reason: `Unknown action type: ${decision.action}`
        };
    }
  }

  validateResponseAction(message) {
    try {
      const client = this.discordClient.getClient();
      
      if (!client || !client.user) {
        return {
          canExecute: false,
          reason: 'Discord client not available'
        };
      }

      // Check if channel allows sending messages
      if (message.guild) {
        const botMember = message.guild.members.cache.get(client.user.id);
        if (botMember) {
          const permissions = botMember.permissionsIn(message.channel);
          
          if (!permissions.has('SendMessages')) {
            return {
              canExecute: false,
              reason: 'Bot cannot send messages in this channel'
            };
          }
        }
      }

      return { canExecute: true };
    } catch (error) {
      logger.error('Error validating response action', {
        source: 'discord',
        error: error.message
      });
      return {
        canExecute: false,
        reason: 'Permission check failed'
      };
    }
  }

  validateReactionAction(message, emoji) {
    try {
      const client = this.discordClient.getClient();
      
      if (!client || !client.user) {
        return {
          canExecute: false,
          reason: 'Discord client not available'
        };
      }

      // Check if channel allows adding reactions
      if (message.guild) {
        const botMember = message.guild.members.cache.get(client.user.id);
        if (botMember) {
          const permissions = botMember.permissionsIn(message.channel);
          
          if (!permissions.has('AddReactions')) {
            return {
              canExecute: false,
              reason: 'Bot cannot add reactions in this channel'
            };
          }
        }
      }

      // Validate emoji format (basic check)
      if (emoji && typeof emoji !== 'string') {
        return {
          canExecute: false,
          reason: 'Invalid emoji format'
        };
      }

      return { canExecute: true };
    } catch (error) {
      logger.error('Error validating reaction action', {
        source: 'discord',
        error: error.message
      });
      return {
        canExecute: false,
        reason: 'Permission check failed'
      };
    }
  }

  validateStatusAction(status) {
    const validStatuses = ['online', 'away', 'dnd', 'invisible'];
    
    if (!status || !validStatuses.includes(status)) {
      return {
        canExecute: false,
        reason: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      };
    }

    try {
      const client = this.discordClient.getClient();
      
      if (!client || !client.user) {
        return {
          canExecute: false,
          reason: 'Discord client not available'
        };
      }

      return { canExecute: true };
    } catch (error) {
      logger.error('Error validating status action', {
        source: 'discord',
        error: error.message
      });
      return {
        canExecute: false,
        reason: 'Status check failed'
      };
    }
  }

  canActInChannel(channel) {
    try {
      const client = this.discordClient.getClient();
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

  getChannelPermissions(channel) {
    try {
      const client = this.discordClient.getClient();
      if (!client || !channel.guild) {
        return {
          isDM: true,
          canSend: true,
          canReact: true,
          canRead: true
        };
      }
      
      const botMember = channel.guild.members.cache.get(client.user.id);
      if (!botMember) {
        return {
          isDM: false,
          canSend: false,
          canReact: false,
          canRead: false,
          error: 'Bot not in guild'
        };
      }
      
      const permissions = botMember.permissionsIn(channel);
      
      return {
        isDM: false,
        canSend: permissions.has('SendMessages'),
        canReact: permissions.has('AddReactions'),
        canRead: permissions.has('ReadMessageHistory'),
        canEmbed: permissions.has('EmbedLinks'),
        canUpload: permissions.has('AttachFiles'),
        canMention: permissions.has('MentionEveryone')
      };
    } catch (error) {
      logger.error('Failed to get channel permissions', {
        source: 'discord',
        error: error.message,
        channel: channel.name
      });
      return {
        isDM: false,
        canSend: false,
        canReact: false,
        canRead: false,
        error: error.message
      };
    }
  }
}

module.exports = ActionValidator;