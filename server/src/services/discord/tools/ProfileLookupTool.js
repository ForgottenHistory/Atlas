const BaseTool = require('./BaseTool');
const logger = require('../../logger/Logger');

class ProfileLookupTool extends BaseTool {
  constructor(discordClient, conversationManager) {
    super('profile_lookup');
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
  }

  async performExecution(context) {
    const { targetUser, message } = context;
    
    // Defensive: ensure message exists and has required properties
    if (!message) {
      throw new Error('Message context is required');
    }

    const safeMessage = {
      id: message.id || 'unknown',
      content: message.content || '',
      author: message.author || {},
      channel: message.channel || {},
      guild: message.guild || null
    };
    
    // Get the Discord client
    const client = this.discordClient.getClient();
    if (!client) {
      throw new Error('Discord client not available');
    }

    // Find the target user
    const guild = safeMessage.guild;
    let targetMember = null;
    let targetUserObj = null;

    // Try to find user by username, display name, or mention
    if (guild && guild.members) {
      try {
        targetMember = guild.members.cache.find(member => 
          member.user.username.toLowerCase() === targetUser.toLowerCase() ||
          member.displayName.toLowerCase() === targetUser.toLowerCase() ||
          member.user.id === targetUser.replace(/[<@!>]/g, '') // Handle mentions
        );
        
        if (targetMember) {
          targetUserObj = targetMember.user;
        }
      } catch (error) {
        logger.warn('Error searching guild members', {
          source: 'tools',
          tool: 'profile_lookup',
          error: error.message
        });
      }
    }

    // If not found in guild, try to find in channel users
    if (!targetUserObj && safeMessage.channel.id) {
      // Check recent conversation history for this user
      const history = this.conversationManager.getHistory(safeMessage.channel.id, 50);
      const userMessage = history.find(msg => 
        msg.author && msg.author.toLowerCase() === targetUser.toLowerCase()
      );
      
      if (userMessage) {
        // We have some info from conversation history
        return this.buildProfileFromHistory(targetUser, history);
      } else {
        throw new Error(`User '${targetUser}' not found in this server or recent conversation`);
      }
    }

    // Build comprehensive profile
    const profile = await this.buildUserProfile(targetUserObj, targetMember, safeMessage.channel, guild);
    
    return profile;
  }

  async buildUserProfile(user, member, channel, guild) {
    // Defensive: ensure user object exists
    if (!user) {
      throw new Error('User object is required');
    }

    const profile = {
      username: user.username || 'Unknown',
      displayName: member ? (member.displayName || user.username) : user.username,
      userId: user.id || 'unknown',
      accountCreated: user.createdAt ? user.createdAt.toISOString() : 'Unknown',
      isBot: user.bot || false,
      status: 'unknown',
      activity: null,
      roles: [],
      permissions: [],
      recentActivity: {},
      serverInfo: {}
    };

    // Get member-specific info if available
    if (member) {
      profile.joinedServer = member.joinedAt ? member.joinedAt.toISOString() : null;
      profile.status = member.presence ? member.presence.status : 'offline';
      
      // Get activity info
      if (member.presence && member.presence.activities && member.presence.activities.length > 0) {
        const activity = member.presence.activities[0];
        profile.activity = {
          type: activity.type || 'unknown',
          name: activity.name || 'Unknown',
          details: activity.details || null,
          state: activity.state || null
        };
      }

      // Get roles (excluding @everyone) - with error handling
      try {
        if (member.roles && member.roles.cache) {
          profile.roles = member.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => ({
              name: role.name || 'Unknown',
              color: role.color || 0,
              position: role.position || 0
            }))
            .sort((a, b) => b.position - a.position);
        }
      } catch (error) {
        logger.warn('Error getting user roles', {
          source: 'tools',
          tool: 'profile_lookup',
          error: error.message
        });
      }

      // Get key permissions - with error handling
      try {
        if (channel && member.permissionsIn) {
          const permissions = member.permissionsIn(channel);
          profile.permissions = [
            { name: 'Administrator', has: permissions.has('Administrator') },
            { name: 'Manage Messages', has: permissions.has('ManageMessages') },
            { name: 'Manage Channels', has: permissions.has('ManageChannels') },
            { name: 'Mention Everyone', has: permissions.has('MentionEveryone') }
          ].filter(perm => perm.has).map(perm => perm.name);
        }
      } catch (error) {
        logger.warn('Error getting user permissions', {
          source: 'tools',
          tool: 'profile_lookup',
          error: error.message
        });
      }
    }

    // Get recent conversation activity - with error handling
    try {
      if (channel && channel.id) {
        const recentMessages = this.conversationManager.getHistory(channel.id, 100)
          .filter(msg => msg.author === user.username)
          .slice(0, 10);

        profile.recentActivity = {
          messageCount: recentMessages.length,
          lastMessage: recentMessages.length > 0 ? {
            content: (recentMessages[0].content || '').substring(0, 100),
            timestamp: recentMessages[0].timestamp || 'Unknown',
            timeAgo: this.getTimeAgo(new Date(recentMessages[0].timestamp || Date.now()))
          } : null,
          averageMessageLength: recentMessages.length > 0 
            ? Math.round(recentMessages.reduce((sum, msg) => sum + (msg.content || '').length, 0) / recentMessages.length)
            : 0,
          activityPattern: this.analyzeActivityPattern(recentMessages)
        };
      }
    } catch (error) {
      logger.warn('Error getting user activity', {
        source: 'tools',
        tool: 'profile_lookup',
        error: error.message
      });
      profile.recentActivity = {
        messageCount: 0,
        lastMessage: null,
        averageMessageLength: 0,
        activityPattern: 'Unable to analyze activity'
      };
    }

    // Server-specific info
    if (guild) {
      profile.serverInfo = {
        serverName: guild.name || 'Unknown',
        memberCount: guild.memberCount || 0,
        timeInServer: member && member.joinedAt 
          ? this.getTimeAgo(member.joinedAt)
          : 'Unknown'
      };
    }

    return profile;
  }

  buildProfileFromHistory(targetUser, history) {
    if (!history || !Array.isArray(history)) {
      return {
        username: targetUser,
        found: false,
        reason: 'No conversation history available'
      };
    }

    const userMessages = history.filter(msg => 
      msg.author && msg.author.toLowerCase() === targetUser.toLowerCase()
    );

    if (userMessages.length === 0) {
      return {
        username: targetUser,
        found: false,
        reason: 'No recent messages found'
      };
    }

    const latestMessage = userMessages[0];
    
    return {
      username: targetUser,
      found: true,
      source: 'conversation_history',
      recentActivity: {
        messageCount: userMessages.length,
        lastMessage: {
          content: (latestMessage.content || '').substring(0, 100),
          timestamp: latestMessage.timestamp || 'Unknown',
          timeAgo: this.getTimeAgo(new Date(latestMessage.timestamp || Date.now()))
        },
        averageMessageLength: Math.round(
          userMessages.reduce((sum, msg) => sum + (msg.content || '').length, 0) / userMessages.length
        ),
        activityPattern: this.analyzeActivityPattern(userMessages)
      }
    };
  }

  analyzeActivityPattern(messages) {
    if (!messages || messages.length === 0) return 'No recent activity';
    
    const now = new Date();
    const recent = messages.filter(msg => {
      if (!msg.timestamp) return false;
      try {
        const msgTime = new Date(msg.timestamp);
        const hoursAgo = (now - msgTime) / (1000 * 60 * 60);
        return hoursAgo <= 24;
      } catch (error) {
        return false;
      }
    });

    if (recent.length === 0) return 'Not active in last 24 hours';
    if (recent.length >= 10) return 'Very active (10+ messages in 24h)';
    if (recent.length >= 5) return 'Active (5-9 messages in 24h)';
    if (recent.length >= 2) return 'Moderately active (2-4 messages in 24h)';
    return 'Low activity (1 message in 24h)';
  }

  getTimeAgo(date) {
    try {
      const now = new Date();
      const inputDate = new Date(date);
      
      // Check if date is valid
      if (isNaN(inputDate.getTime())) {
        return 'Unknown time';
      }
      
      const diffMs = now - inputDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } catch (error) {
      return 'Unknown time';
    }
  }

  validateContext(context) {
    if (!context || typeof context !== 'object') {
      return { isValid: false, reason: 'Context must be an object' };
    }

    if (!context.targetUser) {
      return { isValid: false, reason: 'targetUser is required' };
    }

    if (!context.message) {
      return { isValid: false, reason: 'message context is required' };
    }

    // Be more lenient - just check if message exists, not specific properties
    // since we handle missing properties defensively in performExecution
    return { isValid: true };
  }

  summarizeResult(result) {
    if (!result) {
      return 'No result available';
    }

    if (result.found === false) {
      return `User '${result.username || 'Unknown'}' not found: ${result.reason || 'Unknown reason'}`;
    }

    if (result.source === 'conversation_history') {
      const activity = result.recentActivity || {};
      const lastMessage = activity.lastMessage || {};
      return `${result.username}: ${activity.activityPattern || 'Unknown activity'}, last message ${lastMessage.timeAgo || 'unknown time'}`;
    }

    const statusInfo = result.status && result.status !== 'offline' ? ` (${result.status})` : '';
    const roleInfo = result.roles && result.roles.length > 0 
      ? `, ${result.roles[0].name || 'Unknown role'}` 
      : '';
    const activityInfo = result.recentActivity && result.recentActivity.lastMessage 
      ? `, last active ${result.recentActivity.lastMessage.timeAgo || 'unknown time'}`
      : '';

    return `${result.displayName || result.username || 'Unknown'}${statusInfo}${roleInfo}${activityInfo}`;
  }

  getDescription() {
    return 'Looks up detailed information about a Discord user including their profile, status, roles, and recent activity';
  }

  getRequiredContext() {
    return ['message', 'channel', 'targetUser'];
  }
}

module.exports = ProfileLookupTool;