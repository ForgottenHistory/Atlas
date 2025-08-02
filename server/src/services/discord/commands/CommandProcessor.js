const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');
const LLMService = require('../../llm');

class CommandProcessor {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    this.llmService = new LLMService();
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
    // Get command registry from parent (we'll need to pass it in)
    const storage = require('../../../utils/storage');
    const settings = storage.getSettings();
    const commandPrefix = prefix || settings.commandPrefix || '!';

    // For now, hardcode the default commands
    const defaultCommands = {
      ping: 'Check bot response time',
      help: 'Show available commands',
      info: 'Show bot information',
      clear: 'Clear conversation history',
      memory: 'Show memory usage stats'
    };

    const helpEmbed = {
      color: 0x0099FF,
      title: '🤖 Bot Commands',
      description: 'Available commands for this bot:',
      fields: Object.entries(defaultCommands).map(([name, description]) => ({
        name: `${commandPrefix}${name}`,
        value: description,
        inline: true
      })),
      timestamp: new Date().toISOString(),
      footer: {
        text: `Use ${commandPrefix}<command> to execute`
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

  // Method to create custom command responses
  async createCustomResponse(message, responseText, embedOptions = null) {
    if (embedOptions) {
      const embed = {
        color: embedOptions.color || 0x0099FF,
        title: embedOptions.title || '',
        description: responseText,
        timestamp: new Date().toISOString(),
        ...embedOptions
      };
      
      await message.reply({ embeds: [embed] });
    } else {
      await message.reply(responseText);
    }
  }
}

module.exports = CommandProcessor;