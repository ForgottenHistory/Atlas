const logger = require('../../../logger/Logger');

class TriggerCommand {
  constructor(discordClient, conversationManager) {
    this.discordClient = discordClient;
    this.conversationManager = conversationManager;
  }

  async execute(message, args) {
    try {
      const safeArgs = args || [];
      let targetMessage = null;

      if (safeArgs.length > 0) {
        // Fetch specific message by ID
        const messageId = safeArgs[0];
        try {
          targetMessage = await message.channel.messages.fetch(messageId);
        } catch (error) {
          await message.reply(`❌ Could not find message with ID: ${messageId}`);
          return;
        }
      } else {
        // Find most recent non-bot message
        try {
          const recentMessages = await message.channel.messages.fetch({ limit: 50 });
          
          for (const [, msg] of recentMessages) {
            if (msg.id !== message.id && !msg.author.bot) {
              targetMessage = msg;
              break;
            }
          }
        } catch (error) {
          await message.reply('❌ Could not fetch recent messages');
          return;
        }
      }

      if (!targetMessage) {
        await message.reply('❌ No suitable message found to trigger decision on');
        return;
      }

      // Check age limit (24 hours)
      const messageAgeMs = Date.now() - targetMessage.createdTimestamp;
      const maxAge = 24 * 60 * 60 * 1000;
      
      if (messageAgeMs > maxAge) {
        const hoursOld = Math.round(messageAgeMs / (60 * 60 * 1000));
        await message.reply(`❌ Target message is too old (${hoursOld} hours old, max 24 hours)`);
        return;
      }

      // Process the target message
      await this.processTargetMessage(targetMessage);

      logger.info('Manual trigger command executed', {
        source: 'discord',
        triggerUser: message.author.username,
        targetMessageId: targetMessage.id,
        targetUser: targetMessage.author.username,
        channel: message.channel.name
      });

    } catch (error) {
      logger.error('Error in trigger command', {
        source: 'discord',
        error: error.message,
        author: message.author.username,
        channel: message.channel.name
      });

      await message.reply('❌ Error executing trigger command').catch(() => {});
    }
  }

  async processTargetMessage(targetMessage) {
    try {
      // Import decision engine and action executor
      const MultiLLMDecisionEngine = require('../../../llm/MultiLLMDecisionEngine');
      const ActionExecutor = require('../../ActionExecutor');
      
      const decisionEngine = new MultiLLMDecisionEngine();
      const actionExecutor = new ActionExecutor(this.discordClient, this.conversationManager);

      // Get conversation history
      const conversationHistory = this.conversationManager.getHistory(targetMessage.channel.id, 10);

      // Make decision
      const decision = await decisionEngine.makeDecision({
        message: targetMessage,
        channel: targetMessage.channel,
        author: targetMessage.author,
        conversationHistory: conversationHistory,
        hasImages: false,
        hasEmbeds: !!(targetMessage.embeds && targetMessage.embeds.length > 0),
        embedCount: targetMessage.embeds ? targetMessage.embeds.length : 0,
        isTriggered: true
      });

      logger.info('Manual trigger decision made', {
        source: 'discord',
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        targetMessageId: targetMessage.id
      });

      // Execute the decision
      await actionExecutor.executeAction(decision, targetMessage);

    } catch (error) {
      logger.error('Error processing triggered message', {
        source: 'discord',
        error: error.message,
        targetMessageId: targetMessage.id
      });
    }
  }

  getInfo() {
    return {
      name: 'trigger',
      description: 'Trigger bot decision on recent message',
      usage: '!trigger [messageId]'
    };
  }
}

module.exports = TriggerCommand;