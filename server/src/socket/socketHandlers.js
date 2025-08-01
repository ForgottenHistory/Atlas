const { getBotData, updateRuntimeData } = require('../routes/bot');
const storage = require('../utils/storage');
const discordService = require('../services/discord');
const BotConnectionHandler = require('./handlers/BotConnectionHandler');
const PersonaHandler = require('./handlers/PersonaHandler');
const SettingsHandler = require('./handlers/SettingsHandler');
const DiscordServerHandler = require('./handlers/DiscordServerHandler');

class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.botConnectionHandler = new BotConnectionHandler(io, discordService, { getBotData, updateRuntimeData }, storage);
    this.personaHandler = new PersonaHandler(io, storage);
    this.settingsHandler = new SettingsHandler(io, storage, discordService);
    this.discordServerHandler = new DiscordServerHandler(io, discordService);
  }

  // Bot connection handlers
  async handleToggleBotConnection(socket) {
    return await this.botConnectionHandler.handleToggleBotConnection(socket);
  }

  async handleGetBotStatus(socket) {
    return await this.botConnectionHandler.handleGetBotStatus(socket);
  }

  // Persona handlers
  async handleUpdatePersona(socket, personaData) {
    return await this.personaHandler.handleUpdatePersona(socket, personaData);
  }

  // Settings handlers
  async handleUpdateSettings(socket, settingsData) {
    return await this.settingsHandler.handleUpdateSettings(socket, settingsData);
  }

  // Discord server/channel handlers
  handleGetServers(socket) {
    return this.discordServerHandler.handleGetServers(socket);
  }

  handleGetChannels(socket, data) {
    return this.discordServerHandler.handleGetChannels(socket, data);
  }

  async handleUpdateActiveChannels(socket, data) {
    return await this.discordServerHandler.handleUpdateActiveChannels(socket, data);
  }
}

module.exports = SocketHandlers;