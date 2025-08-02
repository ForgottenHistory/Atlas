class CommandValidator {
  validateCommand(commandInfo, message) {
    const issues = [];
    const warnings = [];

    // Basic validation
    if (!commandInfo.name || commandInfo.name.trim().length === 0) {
      issues.push('Command name is empty');
    }

    // Command name format validation
    if (commandInfo.name && !this.isValidCommandName(commandInfo.name)) {
      issues.push('Command name contains invalid characters');
    }

    // Message context validation
    if (!message) {
      issues.push('Message context is required');
    } else {
      // Channel validation
      if (!message.channel) {
        issues.push('Command must be executed in a valid channel');
      }

      // Author validation
      if (!message.author || message.author.bot) {
        issues.push('Command must be executed by a valid user');
      }

      // Permission checks could go here
      if (this.isRestrictedCommand(commandInfo.name) && !this.hasPermission(message.author, message.channel)) {
        issues.push('Insufficient permissions for this command');
      }
    }

    // Argument validation
    const argValidation = this.validateArguments(commandInfo.name, commandInfo.args);
    if (!argValidation.isValid) {
      issues.push(...argValidation.issues);
    }

    // Rate limiting check
    const rateLimitCheck = this.checkRateLimit(message.author.id, commandInfo.name);
    if (!rateLimitCheck.allowed) {
      issues.push(`Rate limit exceeded. Try again in ${rateLimitCheck.retryAfter} seconds`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      rateLimitInfo: rateLimitCheck
    };
  }

  isValidCommandName(name) {
    // Allow alphanumeric characters, hyphens, and underscores
    const validNamePattern = /^[a-zA-Z0-9_-]+$/;
    return validNamePattern.test(name) && name.length <= 32;
  }

  isRestrictedCommand(commandName) {
    const restrictedCommands = ['clear', 'admin', 'config', 'shutdown'];
    return restrictedCommands.includes(commandName.toLowerCase());
  }

  hasPermission(user, channel) {
    // Basic permission check - can be expanded based on needs
    // For now, just check if user has manage messages permission
    if (channel.guild) {
      const member = channel.guild.members.cache.get(user.id);
      return member && member.permissions.has('ManageMessages');
    }
    
    // In DMs, allow all commands
    return true;
  }

  validateArguments(commandName, args) {
    const issues = [];
    
    // Define argument requirements for each command
    const argumentRules = {
      ping: { min: 0, max: 0 },
      help: { min: 0, max: 1 },
      info: { min: 0, max: 0 },
      clear: { min: 0, max: 1 },
      memory: { min: 0, max: 0 }
    };

    const rule = argumentRules[commandName.toLowerCase()];
    if (rule) {
      if (args.length < rule.min) {
        issues.push(`Command '${commandName}' requires at least ${rule.min} argument(s)`);
      }
      
      if (args.length > rule.max) {
        issues.push(`Command '${commandName}' accepts at most ${rule.max} argument(s)`);
      }
    }

    // Specific argument validation
    if (commandName.toLowerCase() === 'clear' && args.length > 0) {
      const count = parseInt(args[0]);
      if (isNaN(count) || count <= 0 || count > 100) {
        issues.push('Clear command count must be a number between 1 and 100');
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  checkRateLimit(userId, commandName) {
    // Simple in-memory rate limiting
    // In production, this should use Redis or a proper store
    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }

    const key = `${userId}:${commandName}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = this.getCommandRateLimit(commandName);

    if (!this.rateLimitStore.has(key)) {
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
    }

    const record = this.rateLimitStore.get(key);
    
    if (now > record.resetTime) {
      // Reset the window
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    record.count++;
    return { allowed: true, remaining: maxRequests - record.count, retryAfter: 0 };
  }

  getCommandRateLimit(commandName) {
    // Define rate limits per command (requests per minute)
    const rateLimits = {
      ping: 10,
      help: 5,
      info: 5,
      clear: 2,
      memory: 5,
      default: 10
    };

    return rateLimits[commandName.toLowerCase()] || rateLimits.default;
  }

  // Method to validate command execution environment
  validateExecutionEnvironment(message, commandName) {
    const issues = [];

    // Check if bot has required permissions in the channel
    if (message.guild) {
      const botMember = message.guild.members.cache.get(message.client.user.id);
      if (botMember) {
        const permissions = botMember.permissionsIn(message.channel);
        
        if (!permissions.has('SendMessages')) {
          issues.push('Bot cannot send messages in this channel');
        }
        
        if (!permissions.has('EmbedLinks') && this.commandRequiresEmbeds(commandName)) {
          issues.push('Bot cannot send embeds in this channel (required for this command)');
        }
        
        if (!permissions.has('ReadMessageHistory') && commandName === 'clear') {
          issues.push('Bot cannot read message history (required for clear command)');
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  commandRequiresEmbeds(commandName) {
    const embedCommands = ['help', 'info'];
    return embedCommands.includes(commandName.toLowerCase());
  }

  // Clean up rate limit store periodically
  cleanupRateLimitStore() {
    if (!this.rateLimitStore) return;

    const now = Date.now();
    for (const [key, record] of this.rateLimitStore.entries()) {
      if (now > record.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

module.exports = CommandValidator;