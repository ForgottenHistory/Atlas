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
        const hasImages = this.messageHasImages(message);

        // Check if message is emote-only
        if (this.emoteFilter.isEmoteOnly(message.content)) {
            // If message has images, we should still process it even if text is emote-only
            if (hasImages) {
                logger.debug('Message is emote-only but has images, processing anyway', {
                    source: 'discord',
                    author: message.author.username,
                    channel: message.channel.name,
                    originalContent: message.content,
                    hasImages: true
                });

                // Keep original message but mark it as having images
                message.processForImages = true;
                return {
                    shouldProcess: true,
                    cleanedMessage: message
                };
            }

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

        // If cleaning removed everything, check if we have images
        if (!cleanContent || cleanContent.trim().length === 0) {
            if (hasImages) {
                logger.debug('Message became empty after emote removal but has images, processing anyway', {
                    source: 'discord',
                    author: message.author.username,
                    channel: message.channel.name,
                    originalContent: message.content,
                    hasImages: true
                });

                // Set a placeholder content for image-only messages
                message.content = '[Image]';
                message.originalContent = message.content;
                message.processForImages = true;

                return {
                    shouldProcess: true,
                    cleanedMessage: message
                };
            }

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
     * Check if message has images (attachments or embeds)
     * @param {Object} message - Discord message object
     * @returns {boolean} - True if message contains images
     */
    messageHasImages(message) {
        // Check attachments
        if (message.attachments && message.attachments.size > 0) {
            for (const attachment of message.attachments.values()) {
                if (this.isImageAttachment(attachment)) {
                    return true;
                }
            }
        }

        // Check embeds for images
        if (message.embeds && message.embeds.length > 0) {
            for (const embed of message.embeds) {
                if (embed.image?.url || embed.thumbnail?.url) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if attachment is an image
     * @param {Object} attachment - Discord attachment object
     * @returns {boolean} - True if attachment is an image
     */
    isImageAttachment(attachment) {
        if (attachment.contentType) {
            return attachment.contentType.startsWith('image/');
        }

        // Fallback to filename extension
        const ext = attachment.name?.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
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