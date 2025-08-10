const PingCommand = require('./handlers/PingCommand');
const logger = require('../../logger/Logger');

class CommandProcessor {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
    
    // Initialize command handlers
    this.commands = new Map();
    this.initializeCommands();
  }

  initializeCommands() {
    // Register all command handlers
    this.registerCommand(new PingCommand(this.discordClient, this.conversationManager));
    
    logger.info('Command handlers initialized', {
      source: 'discord',
      commandCount: this.commands.size,
      commands: Array.from(this.commands.keys())
    });
  }

  registerCommand(commandHandler) {
    const info = commandHandler.getInfo();
    this.commands.set(info.name, commandHandler);
  }

  async executeCommand(commandName, message, args) {
    const commandHandler = this.commands.get(commandName);
    
    if (!commandHandler) {
      logger.warn('Command handler not found', {
        source: 'discord',
        command: commandName,
        availableCommands: Array.from(this.commands.keys())
      });
      throw new Error(`Command '${commandName}' not found`);
    }

    logger.debug('Executing command via handler', {
      source: 'discord',
      command: commandName,
      author: message.author.username,
      channel: message.channel.name
    });

    await commandHandler.execute(message, args);
  }

  hasCommand(commandName) {
    return this.commands.has(commandName);
  }

  getCommandInfo(commandName) {
    const commandHandler = this.commands.get(commandName);
    return commandHandler ? commandHandler.getInfo() : null;
  }

  getAllCommands() {
    const commandList = [];
    for (const [name, handler] of this.commands) {
      commandList.push(handler.getInfo());
    }
    return commandList;
  }

  getAvailableCommands() {
    return Array.from(this.commands.keys());
  }
}

module.exports = CommandProcessor;