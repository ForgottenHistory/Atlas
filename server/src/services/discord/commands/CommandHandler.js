const storage = require('../../../utils/storage');
const logger = require('../../logger/Logger');
const CommandRegistry = require('./CommandRegistry');
const CommandProcessor = require('./CommandProcessor');
const CommandValidator = require('./CommandValidator');

class CommandHandler {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    
    // Initialize focused services
    this.registry = new CommandRegistry();
    this.processor = new CommandProcessor(discordClient, conversationManager);
    this.validator = new CommandValidator();
    
    // Register default commands
    this.registerDefaultCommands();
    
    logger.info('CommandHandler initialized with modular services', { 
      source: 'discord',
      availableCommands: this.registry.getAvailableCommands(),
      services: ['Registry', 'Processor', 'Validator']
    });
  }

  registerDefaultCommands() {
    this.registry.addCommand('ping', 'Check bot response time', this.processor.handlePingCommand.bind(this.processor));
    this.registry.addCommand('help', 'Show available commands', this.processor.handleHelpCommand.bind(this.processor));
    this.registry.addCommand('info', 'Show bot information', this.processor.handleInfoCommand.bind(this.processor));
    this.registry.addCommand('clear', 'Clear conversation history', this.processor.handleClearCommand.bind(this.processor));
    this.registry.addCommand('memory', 'Show memory usage stats', this.processor.handleMemoryCommand.bind(this.processor));
  }

  async handleCommand(message, prefix) {
    try {
      // Parse command
      const commandInfo = this.parseCommand(message.content, prefix);
      
      // Validate command
      const validation = this.validator.validateCommand(commandInfo, message);
      if (!validation.isValid) {
        logger.warn('Command validation failed', {
          source: 'discord',
          command: commandInfo.name,
          issues: validation.issues,
          author: message.author.username
        });
        return;
      }

      logger.info('Command executed', {
        source: 'discord',
        command: commandInfo.name,
        author: message.author.username,
        channel: message.channel.name,
        args: commandInfo.args
      });

      // Execute command
      const command = this.registry.getCommand(commandInfo.name);
      if (command) {
        await command.handler(message, commandInfo.args, prefix);
      } else {
        await this.processor.handleUnknownCommand(message, commandInfo.name);
      }

      // Log activity
      await storage.addActivity(`Command executed: ${prefix}${commandInfo.name} by ${message.author.username} in #${message.channel.name}`);
      
    } catch (error) {
      logger.error('Error executing command', {
        source: 'discord',
        error: error.message,
        messageId: message.id,
        author: message.author.username,
        channel: message.channel.name
      });
      
      await message.reply('Sorry, there was an error executing that command.').catch(() => {});
    }
  }

  parseCommand(content, prefix) {
    const args = content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    return {
      name: commandName,
      args: args,
      fullContent: content
    };
  }

  // Public API methods
  addCommand(name, description, handler) {
    return this.registry.addCommand(name, description, handler);
  }

  removeCommand(name) {
    return this.registry.removeCommand(name);
  }

  getAvailableCommands() {
    return this.registry.getAvailableCommands();
  }

  getCommandInfo(name) {
    return this.registry.getCommand(name);
  }

  getAllCommands() {
    return this.registry.getAllCommands();
  }
}

module.exports = CommandHandler;