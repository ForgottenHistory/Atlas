const logger = require('../../../logger/Logger');

class PingCommand {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
  }

  async execute(message, args) {
    const sent = await message.reply('Pinging...');
    const timeDiff = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit(`Pong! 🏓 Latency: ${timeDiff}ms`);

    logger.debug('Ping command executed', {
      source: 'discord',
      latency: timeDiff,
      channel: message.channel.name
    });
  }

  getInfo() {
    return {
      name: 'ping',
      description: 'Check bot response time',
      usage: '!ping'
    };
  }
}

module.exports = PingCommand;