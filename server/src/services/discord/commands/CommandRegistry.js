const logger = require('../../logger/Logger');

class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  addCommand(name, description, handler) {
    if (!name || !description || !handler) {
      throw new Error('Command name, description, and handler are required');
    }

    if (typeof handler !== 'function') {
      throw new Error('Command handler must be a function');
    }

    const command = {
      name: name.toLowerCase(),
      description: description,
      handler: handler,
      addedAt: new Date().toISOString()
    };

    this.commands.set(name.toLowerCase(), command);
    
    logger.info('Command registered', {
      source: 'discord',
      command: name,
      description: description
    });

    return true;
  }

  removeCommand(name) {
    const commandName = name.toLowerCase();
    
    if (this.commands.has(commandName)) {
      this.commands.delete(commandName);
      
      logger.info('Command removed', {
        source: 'discord',
        command: name
      });
      
      return true;
    }
    
    return false;
  }

  getCommand(name) {
    return this.commands.get(name.toLowerCase()) || null;
  }

  hasCommand(name) {
    return this.commands.has(name.toLowerCase());
  }

  getAvailableCommands() {
    return Array.from(this.commands.keys());
  }

  getAllCommands() {
    return Object.fromEntries(this.commands);
  }

  getCommandCount() {
    return this.commands.size;
  }

  // Method to get commands with metadata
  getCommandsWithMetadata() {
    const commands = {};
    
    for (const [name, command] of this.commands) {
      commands[name] = {
        description: command.description,
        addedAt: command.addedAt
      };
    }
    
    return commands;
  }

  // Method to validate command exists before execution
  validateCommandExists(name) {
    const command = this.getCommand(name);
    
    return {
      exists: !!command,
      command: command,
      suggestions: this.getSimilarCommands(name)
    };
  }

  // Method to get similar command names (for typo correction)
  getSimilarCommands(name, maxSuggestions = 3) {
    const commandNames = this.getAvailableCommands();
    const suggestions = [];
    
    for (const commandName of commandNames) {
      const similarity = this.calculateSimilarity(name.toLowerCase(), commandName);
      if (similarity > 0.5) { // 50% similarity threshold
        suggestions.push({
          name: commandName,
          similarity: similarity
        });
      }
    }
    
    return suggestions
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSuggestions)
      .map(s => s.name);
  }

  // Simple string similarity calculation
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = CommandRegistry;