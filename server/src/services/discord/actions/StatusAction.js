const logger = require('../../logger/Logger');

class StatusAction {
  constructor(discordClient) {
    this.discordClient = discordClient;
  }

  async executeStatusChange(status) {
    try {
      const client = this.discordClient.getClient();
      
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

  getSupportedStatuses() {
    return ['online', 'away', 'dnd', 'invisible'];
  }

  getCurrentStatus() {
    try {
      const client = this.discordClient.getClient();
      return client?.user?.presence?.status || 'unknown';
    } catch (error) {
      logger.error('Failed to get current status', {
        source: 'discord',
        error: error.message
      });
      return 'unknown';
    }
  }
}

module.exports = StatusAction;