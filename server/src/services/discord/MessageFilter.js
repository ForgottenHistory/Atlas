const emoteFilter = require('../../utils/emoteFilter');
const EmbedProcessor = require('./embed/EmbedProcessor');
const logger = require('../logger/Logger');

class MessageFilter {
    constructor() {
        this.emoteFilter = emoteFilter;
        this.embedProcessor = new EmbedProcessor();
    }

    /**
     * Filter and validate message for processing with embed support
     * @param {Object} message - Discord message object
     * @returns {Object} - { shouldProcess: boolean, cleanedMessage?: Object, reason?: string }
     */
    filterMessage(message) {
        const hasImages = this.messageHasImages(message);
        const embedResult = this.embedProcessor.processMessageEmbeds(message);

        // Check if message is emote-only
        if (this.emoteFilter.isEmoteOnly(message.content)) {
            // If message has images or embeds, process it anyway
            if (hasImages || embedResult.hasEmbeds) {
                logger.debug('Message is emote-only but has images/embeds, processing anyway', {
                    source: 'discord',
                    author: message.author.username,
                    channel: message.channel.name,
                    originalContent: message.content,
                    hasImages: hasImages,
                    hasEmbeds: embedResult.hasEmbeds,
                    embedCount: embedResult.embedCount
                });

                // Keep original message but mark it appropriately
                message.processForImages = hasImages;
                message.processForEmbeds = embedResult.hasEmbeds;

                return {
                    shouldProcess: true,
                    cleanedMessage: message,
                    hasImages: hasImages,
                    hasEmbeds: embedResult.hasEmbeds,
                    embedInfo: embedResult.summary
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

        // If cleaning removed everything, check if we have images or embeds
        if (!cleanContent || cleanContent.trim().length === 0) {
            if (hasImages || embedResult.hasEmbeds) {
                logger.debug('Message became empty after emote removal but has images/embeds, processing anyway', {
                    source: 'discord',
                    author: message.author.username,
                    channel: message.channel.name,
                    originalContent: message.content,
                    hasImages: hasImages,
                    hasEmbeds: embedResult.hasEmbeds,
                    embedCount: embedResult.embedCount
                });

                // Set appropriate content based on what we have
                if (embedResult.hasEmbeds) {
                    message.content = embedResult.formattedContent;
                } else {
                    message.content = '[Image]'; // Fallback for image-only
                }

                message.originalContent = message.content;
                message.processForImages = hasImages;
                message.processForEmbeds = embedResult.hasEmbeds;

                return {
                    shouldProcess: true,
                    cleanedMessage: message,
                    hasImages: hasImages,
                    hasEmbeds: embedResult.hasEmbeds,
                    embedInfo: embedResult.summary
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

        // Message has processable text content
        const originalContent = message.content;
        message.content = cleanContent;
        message.originalContent = originalContent;

        // Add embed content if present
        if (embedResult.hasEmbeds) {
            // Enhance the cleaned content with embed information
            message.content = `${cleanContent}\n\n${embedResult.formattedContent}`;
            message.processForEmbeds = true;

            logger.debug('Enhanced message with embed content', {
                source: 'discord',
                author: message.author.username,
                channel: message.channel.name,
                embedCount: embedResult.embedCount,
                originalTextLength: cleanContent.length,
                enhancedTextLength: message.content.length
            });
        }

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
            cleanedMessage: message,
            hasImages: hasImages,
            hasEmbeds: embedResult.hasEmbeds,
            embedInfo: embedResult.summary
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
        if (!attachment.contentType) {
            // Fallback to filename extension
            const ext = attachment.name?.toLowerCase().split('.').pop();
            return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        }

        return attachment.contentType.startsWith('image/');
    }

    /**
     * Check if attachment is a GIF
     * @param {Object} attachment - Discord attachment object
     * @returns {boolean} - True if attachment is a GIF
     */
    isGifAttachment(attachment) {
        if (attachment.contentType) {
            return attachment.contentType === 'image/gif';
        }

        // Fallback to filename extension
        const ext = attachment.name?.toLowerCase().split('.').pop();
        return ext === 'gif';
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

    /**
     * Get embed processor for external use
     * @returns {EmbedProcessor} - The embed processor instance
     */
    getEmbedProcessor() {
        return this.embedProcessor;
    }
}

module.exports = MessageFilter;