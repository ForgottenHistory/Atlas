const storage = require('../../utils/storage');
const logger = require('../logger/Logger');
const LLMService = require('../llm');

class CommandHandler {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    this.llmService = new LLMService();
    
    // Define available commands
    this.commands = {
      ping: {
        description: 'Check bot response time',
        handler: this.handlePingCommand.bind(this)
      },
      help: {
        description: 'Show available commands',
        handler: this.handleHelpCommand.bind(this)
      },
      info: {
        description: 'Show bot information',
        handler: this.handleInfoCommand.bind(this)
      },
      clear: {
        description: 'Clear conversation history',
        handler: this.handleClearCommand.bind(this)
      },
      memory: {
        description: 'Show memory usage stats',
        handler: this.handleMemoryCommand.bind(this)
      }
    };
    
    logger.info('CommandHandler initialized', { 
      source: 'discord',
      availableCommands: Object.keys(this.commands)
    });
  }

  async handleCommand(message, prefix) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    logger.info('Command executed', {
      source: 'discord',
      command: commandName,
      author: message.author.username,
      channel: message.channel.name,
      args: args
    });

    try {
      const command = this.commands[commandName];
      
      if (command) {
        await command.handler(message, args, prefix);
      } else {
        await this.handleUnknownCommand(message, commandName);
      }

      // Log activity
      await storage.addActivity(`Command executed: ${prefix}${commandName} by ${message.author.username} in #${message.channel.name}`);
      
    } catch (error) {
      logger.error('Error executing command', {
        source: 'discord',
        command: commandName,
        error: error.message,
        author: message.author.username,
        channel: message.channel.name
      });
      
      await message.reply('Sorry, there was an error executing that command.').catch(() => {});
    }
  }

  async handlePingCommand(message) {
    const sent = await message.reply('Pinging...');
    const timeDiff = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit(`Pong! 🏓 Latency: ${timeDiff}ms`);
    
    logger.debug('Ping command executed', {
      source: 'discord',
      latency: timeDiff,
      channel: message.channel.name
    });
  }

  async handleHelpCommand(message, args, prefix) {
    const helpEmbed = {
      color: 0x0099FF,
      title: '🤖 Bot Commands',
      description: 'Available commands for this bot:',
      fields: Object.entries(this.commands).map(([name, cmd]) => ({
        name: `${prefix}${name}`,
        value: cmd.description,
        inline: true
      })),
      timestamp: new Date().toISOString(),
      footer: {
        text: `Use ${prefix}<command> to execute`
      }
    };
    
    await message.reply({ embeds: [helpEmbed] });
  }

  async handleInfoCommand(message) {
    const client = this.discordClient.getClient();
    const persona = storage.getPersona();
    const llmSettings = storage.getLLMSettings();
    const globalStats = this.conversationManager.getGlobalStats();
    
    const infoEmbed = {
      color: 0x00FF00,
      title: persona.name || 'Atlas Bot',
      description: persona.description || 'A Discord bot powered by Atlas Dashboard',
      fields: [
        { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
        { name: 'Users', value: client.users.cache.size.toString(), inline: true },
        { name: 'Uptime', value: this.formatUptime(client.uptime), inline: true },
        { name: 'Context Limit', value: `${llmSettings.context_limit || 4096} tokens`, inline: true },
        { name: 'Max Response', value: `${llmSettings.max_characters || 2000} chars`, inline: true },
        { name: 'Model', value: llmSettings.model || 'Default', inline: true },
        { name: 'Active Channels', value: globalStats.channelsWithHistory.toString(), inline: true },
        { name: 'Total Messages', value: globalStats.totalMessages.toString(), inline: true },
        { name: 'Avg Messages/Channel', value: globalStats.averageMessagesPerChannel.toString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    };
    
    await message.reply({ embeds: [infoEmbed] });
  }

  async handleClearCommand(message) {
    const channelId = message.channel.id;
    const clearedCount = this.conversationManager.clearHistory(channelId);
    
    await message.reply(`🧹 Conversation history cleared for this channel. (${clearedCount} messages removed)`);
    
    logger.info('Conversation history cleared via command', {
      source: 'discord',
      channel: message.channel.name,
      author: message.author.username,
      messagesCleared: clearedCount
    });
  }

  async handleMemoryCommand(message) {
    const channelId = message.channel.id;
    const memoryStats = this.conversationManager.getMemoryStats(channelId);
    
    // Get a preview of how many messages would actually be included in context
    const conversationHistory = this.conversationManager.getHistory(channelId);
    const persona = storage.getPersona();
    const settings = storage.getSettings();
    const llmSettings = storage.getLLMSettings();
    
    const context = {
      systemPrompt: llmSettings.systemPrompt || settings.systemPrompt,
      characterName: persona.name,
      characterDescription: persona.description,
      exampleMessages: persona.mes_example,
      conversationHistory: conversationHistory,
      llmSettings: llmSettings
    };
    
    const preview = this.llmService.previewMessageFit(context);
    
    const memoryInfo = [
      `📊 **Memory Statistics for #${message.channel.name}**`,
      `• Messages stored: ${memoryStats.totalMessages} (no limit)`,
      `• Messages that would fit in context: ${preview.success ? preview.messagesIncluded : 'unknown'}`,
      `• Estimated tokens: ~${memoryStats.estimatedTokens}`,
      `• Context limit: ${memoryStats.contextLimit} tokens`,
      `• Max response: ${memoryStats.maxCharacters} characters`,
      `• Token efficiency: ${preview.success ? Math.round((preview.tokenUsage?.totalTokens / memoryStats.contextLimit) * 100) : memoryStats.usagePercentage}% of context limit`
    ].join('\n');
    
    await message.reply(memoryInfo);
    
    logger.info('Memory stats requested', {
      source: 'discord',
      channel: message.channel.name,
      author: message.author.username,
      stats: memoryStats,
      contextFit: preview.success ? preview.messagesIncluded : 0
    });
  }

  async handleUnknownCommand(message, commandName) {
    const persona = storage.getPersona();
    
    if (persona.name && persona.description) {
      // Respond in character for unknown commands
      await message.reply(`I'm ${persona.name}! ${persona.description.slice(0, 100)}...`);
    } else {
      // Generic help message
      const settings = storage.getSettings();
      const prefix = settings.commandPrefix || '!';
      await message.reply(`I don't recognize that command. Try \`${prefix}help\` for available commands.`);
    }

    logger.warn('Unknown command executed', {
      source: 'discord',
      command: commandName,
      author: message.author.username,
      channel: message.channel.name
    });
  }

  formatUptime(uptime) {
    const seconds = Math.floor((uptime / 1000) % 60);
    const minutes = Math.floor((uptime / (1000 * 60)) % 60);
    const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  // Method to add new commands dynamically
  addCommand(name, description, handler) {
    this.commands[name] = {
      description,
      handler: handler.bind(this)
    };
    
    logger.info('Command added', {
      source: 'discord',
      command: name,
      description
    });
  }

  // Method to remove commands
  removeCommand(name) {
    if (this.commands[name]) {
      delete this.commands[name];
      logger.info('Command removed', {
        source: 'discord',
        command: name
      });
      return true;
    }
    return false;
  }

  // Get list of available commands
  getAvailableCommands() {
    return Object.keys(this.commands);
  }
}

module.exports = CommandHandler;