const storage = require('../../utils/storage');
const logger = require('../logger/Logger');
const ConversationManager = require('./ConversationManager');
const CommandHandler = require('./commands/CommandHandler');
const ResponseGenerator = require('./response/ResponseGenerator');
const MessageFilter = require('./MessageFilter');
const MessageBatcher = require('./MessageBatcher');
const MultiLLMDecisionEngine = require('../llm/MultiLLMDecisionEngine');
const ActionExecutor = require('./ActionExecutor');

class MessageHandler {
  constructor(discordClient, channelManager) {
    this.discordClient = discordClient;
    this.channelManager = channelManager;
    this.eventHandlers = new Map();
    
    // Initialize specialized services
    this.conversationManager = new ConversationManager();
    this.commandHandler = new CommandHandler(discordClient, this.conversationManager);
    this.responseGenerator = new ResponseGenerator(this.conversationManager);
    this.messageFilter = new MessageFilter();
    this.messageBatcher = new MessageBatcher(3000); // 3 second timeout
    
    // NEW: Autonomous decision making
    this.decisionEngine = new MultiLLMDecisionEngine();
    this.actionExecutor = new ActionExecutor(discordClient, this.conversationManager);
    
    this.setupMessageListener();
    
    logger.info('MessageHandler initialized with autonomous decision making', { 
      source: 'discord',
      services: ['ConversationManager', 'CommandHandler', 'ResponseGenerator', 'MessageFilter', 'MessageBatcher', 'DecisionEngine', 'ActionExecutor']
    });
  }

  setupMessageListener() {
    const client = this.discordClient.getClient();
    if (!client) return;

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      await this.handleMessage(message);
      
      // Emit message received event
      this.emit('messageReceived', {
        author: message.author.username,
        content: message.content,
        guild: message.guild?.name || 'DM',
        channel: message.channel.name || 'DM'
      });
    });
  }

  async handleMessage(message) {
    try {
      // Delegate to filter service for basic validation
      const shouldProcess = this.messageFilter.shouldProcessMessage(message, this.channelManager);
      if (!shouldProcess.shouldProcess) {
        return; // Skip processing based on filter decision
      }
      
      // Check if it's a command
      const settings = storage.getSettings();
      const prefix = settings.commandPrefix || '!';
      
      if (message.content.startsWith(prefix)) {
        // Delegate to command handler
        await this.commandHandler.handleCommand(message, prefix);
        return;
      }

      // Delegate to filter service for content filtering
      const filterResult = this.messageFilter.filterMessage(message);
      if (!filterResult.shouldProcess) {
        return; // Skip based on content filter (emotes, etc.)
      }

      // Store in conversation history
      this.conversationManager.addMessage(filterResult.cleanedMessage);

      // NEW: Make autonomous decision instead of always responding
      await this.makeAutonomousDecision(filterResult.cleanedMessage);
      
    } catch (error) {
      logger.error('Error in message handler', {
        source: 'discord',
        error: error.message,
        stack: error.stack,
        messageId: message.id,
        author: message.author.username,
        channel: message.channel.name
      });
      
      // Fallback to simple response on error
      await message.reply('Sorry, something went wrong processing that message.').catch(() => {});
    }
  }

  /**
   * NEW: Autonomous decision making for each message
   */
  async makeAutonomousDecision(message) {
    try {
      // Build context for decision making
      const channelContext = this.buildChannelContext(message);
      
      // Get decision from LLM
      const decision = await this.decisionEngine.makeQuickDecision(message, channelContext);
      
      logger.info('Autonomous decision made', {
        source: 'discord',
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        channel: message.channel.name,
        author: message.author.username,
        messagePreview: message.content.substring(0, 50)
      });

      // Execute the decided action
      const result = await this.actionExecutor.executeAction(decision, message);
      
      if (result.success) {
        // Update decision engine timing
        this.decisionEngine.updateLastActionTime();
        
        // Log successful action
        logger.success('Autonomous action completed', {
          source: 'discord',
          actionType: result.actionType,
          channel: message.channel.name
        });
      } else {
        logger.warn('Autonomous action failed', {
          source: 'discord',
          error: result.error,
          channel: message.channel.name
        });
      }
      
    } catch (error) {
      logger.error('Autonomous decision making failed', {
        source: 'discord',
        error: error.message,
        fallback: 'ignoring message',
        channel: message.channel.name
      });
    }
  }

  /**
   * Build context information for decision making
   */
  buildChannelContext(message) {
    const memoryStats = this.conversationManager.getMemoryStats(message.channel.id);
    const recentHistory = this.conversationManager.getHistory(message.channel.id);
    
    // Calculate activity level based on recent messages
    const recentMessages = recentHistory.slice(-10); // Last 10 messages
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const recentActivity = recentMessages.filter(msg => 
      (now - new Date(msg.timestamp)) < timeWindow
    );
    
    let activityLevel = 'quiet';
    if (recentActivity.length > 5) activityLevel = 'active';
    else if (recentActivity.length > 2) activityLevel = 'normal';

    return {
      channelId: message.channel.id,
      channelName: message.channel.name || 'Unknown',
      serverId: message.guild?.id || 'DM',
      serverName: message.guild?.name || 'Direct Message',
      activityLevel: activityLevel,
      recentMessageCount: recentActivity.length,
      totalMessages: memoryStats.totalMessages,
      lastAction: 'none', // TODO: Track last action per channel
      canReact: this.actionExecutor.canActInChannel(message.channel),
      conversationContext: recentMessages.slice(-3) // Last 3 messages for context
    };
  }

  /**
   * Legacy method for direct response (still used by batcher)
   */
  async processMessage(message) {
    try {
      // Generate response using existing system
      await this.responseGenerator.generateAndSendResponse(message);
    } catch (error) {
      logger.error('Error processing message via legacy path', {
        source: 'discord',
        error: error.message,
        author: message.author?.username || 'Unknown',
        channel: message.channel?.name || 'Unknown'
      });
    }
  }

  // Public API - delegate to appropriate services
  getConversationHistory(channelId) {
    return this.conversationManager.getHistory(channelId);
  }

  clearConversationHistory(channelId) {
    return this.conversationManager.clearHistory(channelId);
  }

  getMemoryStats(channelId) {
    return this.conversationManager.getMemoryStats(channelId);
  }

  getBatchStats() {
    return this.messageBatcher.getBatchStats();
  }

  getQueueStats() {
    return this.responseGenerator.getQueueStats();
  }

  getQueueHealth() {
    return this.responseGenerator.getQueueHealth();
  }

  // NEW: Get decision engine stats
  getDecisionStats() {
    return {
      lastDecisionTime: this.decisionEngine.lastDecisionTime,
      timeSinceLastAction: this.decisionEngine.timeSinceLastAction()
    };
  }

  // Event system
  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('Error in message handler event', {
          source: 'discord',
          event: event,
          error: error.message
        });
      }
    });
  }
}

module.exports = MessageHandler;