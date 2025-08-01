class DiscordServerHandler {
  constructor(io, discordService) {
    this.io = io;
    this.discordService = discordService;
  }

  handleGetServers(socket) {
    try {
      const servers = this.discordService.getServers();
      socket.emit('serversData', { servers });
    } catch (error) {
      console.error('Error getting servers:', error);
      socket.emit('serversData', { servers: [], error: 'Failed to get servers' });
    }
  }

  handleGetChannels(socket, data) {
    try {
      const { serverId } = data;
      
      if (!serverId) {
        socket.emit('channelsData', { channels: [], error: 'Server ID required' });
        return;
      }

      const channels = this.discordService.getChannels(serverId);
      const activeChannels = this.discordService.getActiveChannels(serverId);
      
      socket.emit('channelsData', { 
        channels, 
        activeChannels,
        serverId 
      });
    } catch (error) {
      console.error('Error getting channels:', error);
      socket.emit('channelsData', { channels: [], error: 'Failed to get channels' });
    }
  }

  async handleUpdateActiveChannels(socket, data) {
    try {
      const { serverId, channelIds } = data;
      
      const validation = this._validateChannelData(serverId, channelIds);
      if (!validation.isValid) {
        socket.emit('activeChannelsUpdated', { 
          success: false, 
          error: validation.error 
        });
        return;
      }

      const success = await this.discordService.updateActiveChannels(serverId, channelIds);
      
      socket.emit('activeChannelsUpdated', { 
        success,
        serverId,
        channelIds: success ? channelIds : []
      });

    } catch (error) {
      console.error('Error updating active channels:', error);
      socket.emit('activeChannelsUpdated', { 
        success: false, 
        error: 'Failed to update active channels' 
      });
    }
  }

  _validateChannelData(serverId, channelIds) {
    if (!serverId) {
      return { isValid: false, error: 'Server ID is required' };
    }

    if (!Array.isArray(channelIds)) {
      return { isValid: false, error: 'Channel IDs must be an array' };
    }

    return { isValid: true };
  }
}

module.exports = DiscordServerHandler;