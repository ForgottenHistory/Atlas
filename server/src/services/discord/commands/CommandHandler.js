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
    // Get available commands from the processor
    const availableCommands = this.processor.getAllCommands();

    // Register each command in the registry
    availableCommands.forEach(commandInfo => {
      this.registry.addCommand(
        commandInfo.name,
        commandInfo.description,
        async (message, args, prefix) => {
          await this.processor.executeCommand(commandInfo.name, message, args);
        }
      );
    });

    logger.info('Commands registered in registry', {
      source: 'discord',
      registeredCommands: this.registry.getAvailableCommands()
    });
  }

  async handleCommand(message, prefix) {
    try {
      logger.debug('handleCommand called with parameters', {
        source: 'discord',
        messageContent: message.content,
        prefix: prefix,
        prefixType: typeof prefix,
        prefixLength: prefix ? prefix.length : 0,
        author: message.author.username
      });

      // Parse command
      const commandInfo = this.parseCommand(message.content, prefix);

      logger.info('Command parsed', {
        source: 'discord',
        rawContent: message.content,
        commandName: commandInfo.name,
        args: commandInfo.args,
        author: message.author.username,
        channel: message.channel.name,
        availableCommands: this.registry.getAvailableCommands()
      });

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

      // Check if command exists in processor
      if (this.processor.hasCommand(commandInfo.name)) {
        logger.info('Executing command via processor', {
          source: 'discord',
          command: commandInfo.name,
          author: message.author.username,
          channel: message.channel.name
        });

        await this.processor.executeCommand(commandInfo.name, message, commandInfo.args);

        logger.success('Command executed successfully', {
          source: 'discord',
          command: commandInfo.name,
          author: message.author.username
        });
      } else {
        logger.warn('Command not found in processor', {
          source: 'discord',
          command: commandInfo.name,
          availableCommands: this.processor.getAvailableCommands()
        });

        await this.handleUnknownCommand(message, commandInfo.name);
      }

      // Log activity
      const storage = require('../../../utils/storage');
      await storage.addActivity(`Command executed: ${prefix}${commandInfo.name} by ${message.author.username} in #${message.channel.name}`);

    } catch (error) {
      logger.error('Error executing command', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message.id,
        author: message.author.username,
        channel: message.channel.name,
        messageContent: message.content
      });

      await message.reply('Sorry, there was an error executing that command.').catch(() => { });
    }
  }

  async handleUnknownCommand(message, commandName) {
    const storage = require('../../../utils/storage');
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

  parseCommand(content, prefix) {
    logger.debug('Parsing command', {
      source: 'discord',
      content: content,
      prefix: prefix,
      contentLength: content ? content.length : 0
    });

    if (!content || !prefix) {
      logger.warn('Invalid content or prefix for command parsing', {
        source: 'discord',
        hasContent: !!content,
        hasPrefix: !!prefix
      });
      return { name: '', args: [], fullContent: content || '' };
    }

    const args = content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    logger.debug('Command parsed result', {
      source: 'discord',
      commandName: commandName,
      args: args,
      argsCount: args.length
    });

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