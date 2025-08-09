const BaseTool = require('./BaseTool');
const logger = require('../../logger/Logger');

class ProfileLookupTool extends BaseTool {
  constructor(discordClient, conversationManager) {
    super('profile_lookup');
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
  }

  async performExecution(context) {
    const { targetUser, message, channel } = context;
    
    // Get the Discord client
    const client = this.discordClient.getClient();
    if (!client) {
      throw new Error('Discord client not available');
    }

    // Find the target user
    const guild = message.guild;
    let targetMember = null;
    let targetUserObj = null;

    // Try to find user by username, display name, or mention
    if (guild) {
      targetMember = guild.members.cache.find(member => 
        member.user.username.toLowerCase() === targetUser.toLowerCase() ||
        member.displayName.toLowerCase() === targetUser.toLowerCase() ||
        member.user.id === targetUser.replace(/[<@!>]/g, '') // Handle mentions
      );
      
      if (targetMember) {
        targetUserObj = targetMember.user;
      }
    }

    // If not found in guild, try to find in channel users
    if (!targetUserObj) {
      // Check recent conversation history for this user
      const history = this.conversationManager.getHistory(channel.id, 50);
      const userMessage = history.find(msg => 
        msg.author.toLowerCase() === targetUser.toLowerCase()
      );
      
      if (userMessage) {
        // We have some info from conversation history
        return this.buildProfileFromHistory(targetUser, history);
      } else {
        throw new Error(`User '${targetUser}' not found in this server or recent conversation`);
      }
    }

    // Build comprehensive profile
    const profile = await this.buildUserProfile(targetUserObj, targetMember, channel, guild);
    
    return profile;
  }

  async buildUserProfile(user, member, channel, guild) {
    const profile = {
      username: user.username,
      displayName: member ? member.displayName : user.username,
      userId: user.id,
      accountCreated: user.createdAt.toISOString(),
      isBot: user.bot,
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
          type: activity.type,
          name: activity.name,
          details: activity.details,
          state: activity.state
        };
      }

      // Get roles (excluding @everyone)
      profile.roles = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .map(role => ({
          name: role.name,
          color: role.color,
          position: role.position
        }))
        .sort((a, b) => b.position - a.position);

      // Get key permissions
      const permissions = member.permissionsIn(channel);
      profile.permissions = [
        { name: 'Administrator', has: permissions.has('Administrator') },
        { name: 'Manage Messages', has: permissions.has('ManageMessages') },
        { name: 'Manage Channels', has: permissions.has('ManageChannels') },
        { name: 'Mention Everyone', has: permissions.has('MentionEveryone') }
      ].filter(perm => perm.has).map(perm => perm.name);
    }

    // Get recent conversation activity
    const recentMessages = this.conversationManager.getHistory(channel.id, 100)
      .filter(msg => msg.author === user.username)
      .slice(0, 10);

    profile.recentActivity = {
      messageCount: recentMessages.length,
      lastMessage: recentMessages.length > 0 ? {
        content: recentMessages[0].content.substring(0, 100),
        timestamp: recentMessages[0].timestamp,
        timeAgo: this.getTimeAgo(new Date(recentMessages[0].timestamp))
      } : null,
      averageMessageLength: recentMessages.length > 0 
        ? Math.round(recentMessages.reduce((sum, msg) => sum + msg.content.length, 0) / recentMessages.length)
        : 0,
      activityPattern: this.analyzeActivityPattern(recentMessages)
    };

    // Server-specific info
    if (guild) {
      profile.serverInfo = {
        serverName: guild.name,
        memberCount: guild.memberCount,
        timeInServer: member && member.joinedAt 
          ? this.getTimeAgo(member.joinedAt)
          : 'Unknown'
      };
    }

    return profile;
  }

  buildProfileFromHistory(targetUser, history) {
    const userMessages = history.filter(msg => 
      msg.author.toLowerCase() === targetUser.toLowerCase()
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
          content: latestMessage.content.substring(0, 100),
          timestamp: latestMessage.timestamp,
          timeAgo: this.getTimeAgo(new Date(latestMessage.timestamp))
        },
        averageMessageLength: Math.round(
          userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length
        ),
        activityPattern: this.analyzeActivityPattern(userMessages)
      }
    };
  }

  analyzeActivityPattern(messages) {
    if (messages.length === 0) return 'No recent activity';
    
    const now = new Date();
    const recent = messages.filter(msg => {
      const msgTime = new Date(msg.timestamp);
      const hoursAgo = (now - msgTime) / (1000 * 60 * 60);
      return hoursAgo <= 24;
    });

    if (recent.length === 0) return 'Not active in last 24 hours';
    if (recent.length >= 10) return 'Very active (10+ messages in 24h)';
    if (recent.length >= 5) return 'Active (5-9 messages in 24h)';
    if (recent.length >= 2) return 'Moderately active (2-4 messages in 24h)';
    return 'Low activity (1 message in 24h)';
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }

  validateContext(context) {
    if (!context.targetUser) {
      return { isValid: false, reason: 'targetUser is required' };
    }

    if (!context.message) {
      return { isValid: false, reason: 'message context is required' };
    }

    if (!context.channel) {
      return { isValid: false, reason: 'channel context is required' };
    }

    return { isValid: true };
  }

  summarizeResult(result) {
    if (!result.found && result.found === false) {
      return `User '${result.username}' not found: ${result.reason}`;
    }

    if (result.source === 'conversation_history') {
      return `${result.username}: ${result.recentActivity.activityPattern}, last message ${result.recentActivity.lastMessage.timeAgo}`;
    }

    const statusInfo = result.status !== 'offline' ? ` (${result.status})` : '';
    const roleInfo = result.roles && result.roles.length > 0 
      ? `, ${result.roles[0].name}` 
      : '';
    const activityInfo = result.recentActivity.lastMessage 
      ? `, last active ${result.recentActivity.lastMessage.timeAgo}`
      : '';

    return `${result.displayName}${statusInfo}${roleInfo}${activityInfo}`;
  }

  getDescription() {
    return 'Looks up detailed information about a Discord user including their profile, status, roles, and recent activity';
  }

  getRequiredContext() {
    return ['message', 'channel', 'targetUser'];
  }
}

module.exports = ProfileLookupTool;