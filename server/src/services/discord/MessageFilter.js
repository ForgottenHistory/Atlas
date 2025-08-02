const emoteFilter = require('../../utils/emoteFilter');
const logger = require('../logger/Logger');

class MessageFilter {
    constructor() {
        this.emoteFilter = emoteFilter;
    }

    /**
       * Filter and validate message for processing
       * @param {Object} message - Discord message object
       * @returns {Object} - { shouldProcess: boolean, cleanedMessage?: Object, reason?: string }
       */
    filterMessage(message) {
        // Check if message is emote-only
        if (this.emoteFilter.isEmoteOnly(message.content)) {
            logger.debug('Ignoring emote-only message', {
                source: 'discord',
                author: message.author.username,
                channel: message.channel.name,
                originalContent: message.content
            });

            return {
                shouldProcess: false,
                reason: 'emote_only'
            };
        }

        // Clean emotes from message content
        const cleanContent = this.emoteFilter.removeEmotes(message.content);

        // If cleaning removed everything, skip
        if (!cleanContent || cleanContent.trim().length === 0) {
            logger.debug('Message became empty after emote removal', {
                source: 'discord',
                author: message.author.username,
                channel: message.channel.name,
                originalContent: message.content
            });

            return {
                shouldProcess: false,
                reason: 'empty_after_cleaning'
            };
        }

        // FIX: Don't create new object, modify the original message directly
        const originalContent = message.content;
        message.content = cleanContent;
        message.originalContent = originalContent;

        // Log emote filtering if emotes were found
        const emoteStats = this.emoteFilter.getEmoteStats(originalContent);
        if (emoteStats.totalEmotes > 0) {
            logger.debug('Emotes filtered from message', {
                source: 'discord',
                author: message.author.username,
                channel: message.channel.name,
                customEmotes: emoteStats.customEmotes,
                unicodeEmotes: emoteStats.unicodeEmotes,
                originalLength: originalContent.length,
                cleanedLength: cleanContent.length
            });
        }

        return {
            shouldProcess: true,
            cleanedMessage: message // Return the modified original message
        };
    }

    /**
     * Check if message should be processed based on various criteria
     * @param {Object} message - Discord message object
     * @param {Object} channelManager - Channel manager instance
     * @returns {Object} - { shouldProcess: boolean, reason?: string }
     */
    shouldProcessMessage(message, channelManager) {
        // Skip bot messages
        if (message.author.bot) {
            return {
                shouldProcess: false,
                reason: 'bot_message'
            };
        }

        // Check if channel is active
        if (!channelManager.isChannelActive(message.channel.id)) {
            logger.debug('Message in inactive channel ignored', {
                source: 'discord',
                channel: message.channel.name,
                author: message.author.username
            });

            return {
                shouldProcess: false,
                reason: 'inactive_channel'
            };
        }

        return {
            shouldProcess: true
        };
    }
}

module.exports = MessageFilter;