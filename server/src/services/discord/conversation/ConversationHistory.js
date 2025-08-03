const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');

class ConversationHistory {
  constructor() {
    this.conversationHistory = new Map(); // channelId -> messages array
  }

  addMessage(message, isBot = false) {
    const channelId = message.channel.id;
    const serverId = message.guild?.id || 'DM';
    const serverName = message.guild?.name || 'Direct Message';
    const channelName = message.channel.name || 'DM';
    
    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    
    const history = this.conversationHistory.get(channelId);
    
    // Create enhanced message object with server context
    const messageObj = {
      author: isBot ? (storage.getPersona().name || 'Bot') : message.author.username,
      content: message.content,
      timestamp: new Date(),
      isBot: isBot,
      messageId: message.id,
      channelId: channelId,
      channelName: channelName,
      serverId: serverId,
      serverName: serverName,
      // Store user info for better context
      userId: message.author?.id,
      userDisplayName: message.author?.displayName || message.author?.username,
      // Include image analysis if present
      imageAnalysis: message.imageAnalysis || null
    };
    
    // Add new message to the beginning (most recent first)
    history.unshift(messageObj);
    
    // No artificial limits - let token management handle it dynamically

    logger.debug('Added message to channel conversation history', {
      source: 'discord',
      channelId: channelId,
      channelName: channelName,
      serverId: serverId,
      serverName: serverName,
      totalHistoryLength: history.length,
      isBot: isBot,
      messageLength: message.content.length,
      author: messageObj.author,
      hasImageAnalysis: !!messageObj.imageAnalysis
    });

    return messageObj;
  }

  getHistory(channelId, limit = null) {
    // Return history in reverse order (oldest first) for the LLM
    const history = this.conversationHistory.get(channelId) || [];
    const limitedHistory = limit ? history.slice(0, limit) : history;
    return [...limitedHistory].reverse();
  }

  hasHistory(channelId) {
    const history = this.conversationHistory.get(channelId) || [];
    return history.length > 0;
  }

  getHistoryLength(channelId) {
    const history = this.conversationHistory.get(channelId) || [];
    return history.length;
  }

  getAllChannelIds() {
    return Array.from(this.conversationHistory.keys());
  }

  getAllChannelsWithMessages() {
    const channels = [];
    
    for (const [channelId, history] of this.conversationHistory.entries()) {
      if (history.length > 0) {
        const channelInfo = history[0]; // Get info from first message
        
        channels.push({
          channelId: channelId,
          channelName: channelInfo.channelName || 'Unknown',
          serverId: channelInfo.serverId || 'DM',
          serverName: channelInfo.serverName || 'Direct Messages',
          messageCount: history.length,
          lastMessage: {
            content: history[0].content.substring(0, 50) + (history[0].content.length > 50 ? '...' : ''),
            author: history[0].author,
            timestamp: history[0].timestamp
          }
        });
      }
    }
    
    // Sort by most recent activity
    channels.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
    
    return channels;
  }

  removeChannel(channelId) {
    const history = this.conversationHistory.get(channelId) || [];
    const messageCount = history.length;
    this.conversationHistory.delete(channelId);
    return messageCount;
  }

  removeAllChannels() {
    const totalMessages = Array.from(this.conversationHistory.values())
      .reduce((total, history) => total + history.length, 0);
    this.conversationHistory.clear();
    return totalMessages;
  }

  filterChannelsByServer(serverId) {
    const serverChannels = [];
    
    for (const [channelId, history] of this.conversationHistory.entries()) {
      if (history.length > 0) {
        const channelInfo = history[0];
        if (channelInfo.serverId === serverId) {
          serverChannels.push(channelId);
        }
      }
    }
    
    return serverChannels;
  }

  getServerStats(serverId) {
    let channels = 0;
    let messages = 0;
    
    for (const [channelId, history] of this.conversationHistory.entries()) {
      if (history.length > 0) {
        const channelInfo = history[0];
        if (channelInfo.serverId === serverId) {
          channels++;
          messages += history.length;
        }
      }
    }
    
    return { channels, messages };
  }
}

module.exports = ConversationHistory;