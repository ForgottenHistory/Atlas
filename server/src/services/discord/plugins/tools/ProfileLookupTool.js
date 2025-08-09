const Tool = require('../interfaces/Tool');
const logger = require('../../../logger/Logger');

/**
 * Profile lookup tool converted to plugin architecture
 * Looks up detailed Discord user information
 */
class ProfileLookupTool extends Tool {
  constructor(config = {}, dependencies = {}) {
    super(config, dependencies);
    
    this.discordClient = dependencies.discordClient;
    this.conversationManager = dependencies.conversationManager;
    
    if (!this.discordClient) {
      throw new Error('ProfileLookupTool requires discordClient dependency');
    }
  }

  /**
   * Execute profile lookup
   */
  async execute(context) {
    const { message, targetUser } = context;
    
    // Extract target user from message if not provided
    const userToLookup = targetUser || this.extractTargetUser(message);
    
    if (!userToLookup) {
      return this.error(new Error('No target user specified for profile lookup'));
    }

    try {
      // Get the Discord client
      const client = this.discordClient.getClient();
      if (!client) {
        return this.error(new Error('Discord client not available'));
      }

      // Find the target user
      const userProfile = await this.findAndBuildProfile(userToLookup, message);
      
      return this.success(userProfile, {
        targetUser: userToLookup,
        source: userProfile.source || 'discord_api'
      });

    } catch (error) {
      logger.error('Profile lookup failed', {
        source: 'plugin',
        plugin: this.name,
        targetUser: userToLookup,
        error: error.message
      });
      
      return this.error(error);
    }
  }

  /**
   * Check if tool should execute for this context
   */
  async shouldExecute(context) {
    const { message } = context;
    
    // Execute if message mentions users or contains profile-related keywords
    const hasUserMentions = message.mentions?.users?.size > 0;
    const hasProfileKeywords = this.hasProfileKeywords(message.content);
    const hasTargetUser = !!context.targetUser;
    
    return hasUserMentions || hasProfileKeywords || hasTargetUser;
  }

  /**
   * Get tool metadata
   */
  getMetadata() {
    return {
      name: 'ProfileLookupTool',
      type: 'tool',
      description: 'Looks up detailed information about Discord users including profile, status, roles, and recent activity',
      capabilities: [
        'user_profile_lookup',
        'status_checking', 
        'role_analysis',
        'activity_tracking',
        'conversation_history'
      ],
      requiredPermissions: ['VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'],
      estimatedExecutionTime: '2-4s',
      rateLimitInfo: {
        sensitive: false,
        category: 'user_lookup'
      }
    };
  }

  /**
   * Validate execution context
   */
  validateContext(context) {
    const result = super.validateContext(context);
    
    if (!result.valid) {
      return result;
    }

    if (!context.message) {
      result.valid = false;
      result.errors.push('Message context is required');
    }

    return result;
  }

  // === CORE LOGIC METHODS ===

  /**
   * Extract target user from message content or mentions
   */
  extractTargetUser(message) {
    // Check direct mentions first
    if (message.mentions?.users?.size > 0) {
      const firstMention = message.mentions.users.first();
      return firstMention.username;
    }

    // Check for @username patterns in content
    const mentionMatch = message.content?.match(/@(\w+)/);
    if (mentionMatch) {
      return mentionMatch[1];
    }

    // Check for profile lookup keywords with username
    const profileMatch = message.content?.match(/profile\s+(?:of\s+)?@?(\w+)/i);
    if (profileMatch) {
      return profileMatch[1];
    }

    const userMatch = message.content?.match(/user\s+@?(\w+)/i);
    if (userMatch) {
      return userMatch[1];
    }

    return null;
  }

  /**
   * Check if message contains profile-related keywords
   */
  hasProfileKeywords(content) {
    if (!content) return false;
    
    const keywords = ['profile', 'user', 'status', 'info', 'lookup', 'who is', 'about'];
    const lowerContent = content.toLowerCase();
    
    return keywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Find user and build comprehensive profile
   */
  async findAndBuildProfile(targetUser, message) {
    const guild = message.guild;
    let targetMember = null;
    let targetUserObj = null;

    // Try to find user in guild
    if (guild?.members) {
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
          source: 'plugin',
          plugin: this.name,
          error: error.message
        });
      }
    }

    // If not found in guild, try conversation history
    if (!targetUserObj && this.conversationManager) {
      return this.buildProfileFromHistory(targetUser, message.channel.id);
    }

    if (!targetUserObj) {
      throw new Error(`User '${targetUser}' not found in this server or recent conversation`);
    }

    // Build comprehensive profile
    return await this.buildUserProfile(targetUserObj, targetMember, message.channel, guild);
  }

  /**
   * Build comprehensive user profile from Discord data
   */
  async buildUserProfile(user, member, channel, guild) {
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
      serverInfo: {},
      found: true,
      source: 'discord_api'
    };

    // Get member-specific info
    if (member) {
      profile.joinedServer = member.joinedAt ? member.joinedAt.toISOString() : null;
      profile.status = member.presence ? member.presence.status : 'offline';
      
      // Get activity info
      if (member.presence?.activities?.length > 0) {
        const activity = member.presence.activities[0];
        profile.activity = {
          type: activity.type || 'unknown',
          name: activity.name || 'Unknown',
          details: activity.details || null,
          state: activity.state || null
        };
      }

      // Get roles (excluding @everyone)
      try {
        if (member.roles?.cache) {
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
          source: 'plugin',
          plugin: this.name,
          error: error.message
        });
      }

      // Get key permissions
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
          source: 'plugin',
          plugin: this.name,
          error: error.message
        });
      }
    }

    // Get recent activity from conversation manager
    if (this.conversationManager && channel?.id) {
      try {
        const recentMessages = this.conversationManager.getHistory(channel.id, 100)
          ?.filter(msg => msg.author === user.username)
          ?.slice(0, 10) || [];

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
      } catch (error) {
        logger.warn('Error getting user activity', {
          source: 'plugin',
          plugin: this.name,
          error: error.message
        });
      }
    }

    // Server info
    if (guild) {
      profile.serverInfo = {
        serverName: guild.name || 'Unknown',
        memberCount: guild.memberCount || 0,
        timeInServer: member?.joinedAt ? this.getTimeAgo(member.joinedAt) : 'Unknown'
      };
    }

    return profile;
  }

  /**
   * Build profile from conversation history when user not found in guild
   */
  buildProfileFromHistory(targetUser, channelId) {
    if (!this.conversationManager) {
      return {
        username: targetUser,
        found: false,
        reason: 'No conversation manager available'
      };
    }

    const history = this.conversationManager.getHistory(channelId, 50) || [];
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

  // === HELPER METHODS ===

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
}

module.exports = ProfileLookupTool;