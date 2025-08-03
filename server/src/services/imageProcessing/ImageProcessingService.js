const OpenRouterProvider = require('../llm/providers/OpenRouterProvider');
const storage = require('../../utils/storage');
const logger = require('../logger/Logger');

class ImageProcessingService {
  constructor() {
    this.providers = new Map();
    this.initializeProviders();
    
    logger.info('Image Processing Service initialized', {
      source: 'imageProcessing',
      availableProviders: Array.from(this.providers.keys())
    });
  }

  initializeProviders() {
    // Initialize OpenRouter provider
    const openRouterProvider = new OpenRouterProvider();
    this.providers.set('openrouter', openRouterProvider);
    
    // Future providers can be added here
    // const anthropicProvider = new AnthropicProvider();
    // this.providers.set('anthropic', anthropicProvider);
  }

  async processDiscordMessage(message) {
    try {
      // Check if image processing is enabled
      const imageSettings = this.getImageSettings();
      if (!imageSettings.enabled) {
        logger.debug('Image processing disabled', { source: 'imageProcessing' });
        return null;
      }

      // Extract images from Discord message
      const images = this.extractImagesFromMessage(message);
      if (images.length === 0) {
        return null;
      }

      logger.info('Processing Discord message with images', {
        source: 'imageProcessing',
        imageCount: images.length,
        channel: message.channel.name,
        author: message.author.username
      });

      // Process each image
      const results = [];
      for (const image of images) {
        try {
          const result = await this.processImage(image, message, imageSettings);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          logger.error('Failed to process individual image', {
            source: 'imageProcessing',
            error: error.message,
            imageUrl: image.url
          });
        }
      }

      return results.length > 0 ? results : null;

    } catch (error) {
      logger.error('Error processing Discord message for images', {
        source: 'imageProcessing',
        error: error.message,
        messageId: message.id
      });
      return null;
    }
  }

  extractImagesFromMessage(message) {
    const images = [];

    // Extract from attachments
    if (message.attachments && message.attachments.size > 0) {
      message.attachments.forEach(attachment => {
        if (this.isImageAttachment(attachment)) {
          images.push({
            url: attachment.url,
            filename: attachment.name,
            size: attachment.size,
            source: 'attachment'
          });
        }
      });
    }

    // Extract from embeds (images shared via links)
    if (message.embeds && message.embeds.length > 0) {
      message.embeds.forEach(embed => {
        if (embed.image && embed.image.url) {
          images.push({
            url: embed.image.url,
            filename: 'embedded_image',
            source: 'embed'
          });
        }
        if (embed.thumbnail && embed.thumbnail.url) {
          images.push({
            url: embed.thumbnail.url,
            filename: 'thumbnail',
            source: 'thumbnail'
          });
        }
      });
    }

    logger.debug('Extracted images from Discord message', {
      source: 'imageProcessing',
      imageCount: images.length,
      sources: images.map(img => img.source)
    });

    return images;
  }

  isImageAttachment(attachment) {
    if (!attachment.contentType) {
      // Fallback to filename extension
      const ext = attachment.name?.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    }
    
    return attachment.contentType.startsWith('image/');
  }

  async processImage(image, message, settings) {
    try {
      // Download the image
      const imageBuffer = await this.downloadImage(image.url);
      
      // Validate image size
      const maxSizeMB = settings.maxSize || 5;
      this.validateImageSize(imageBuffer, maxSizeMB);

      // Get the appropriate provider
      const provider = this.providers.get(settings.provider);
      if (!provider) {
        throw new Error(`Image provider '${settings.provider}' not available`);
      }

      // Generate context-aware prompt
      const prompt = this.generateImagePrompt(message, image);

      // Analyze the image
      const analysisSettings = {
        apiKey: settings.apiKey,
        model: settings.model,
        quality: settings.quality || 2,
        maxTokens: 1000,
        temperature: 0.7
      };

      const result = await provider.analyzeImage(imageBuffer, prompt, analysisSettings);

      logger.success('Image analysis completed', {
        source: 'imageProcessing',
        provider: settings.provider,
        model: settings.model,
        imageSource: image.source,
        responseLength: result.content.length
      });

      return {
        imageUrl: image.url,
        filename: image.filename,
        analysis: result.content,
        provider: settings.provider,
        model: settings.model,
        usage: result.usage
      };

    } catch (error) {
      logger.error('Image processing failed', {
        source: 'imageProcessing',
        error: error.message,
        imageUrl: image.url,
        provider: settings.provider
      });
      throw error;
    }
  }

  async downloadImage(url) {
    try {
      logger.debug('Downloading image', {
        source: 'imageProcessing',
        url: url.substring(0, 100) + '...'
      });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Atlas Discord Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      logger.debug('Image downloaded successfully', {
        source: 'imageProcessing',
        size: `${(buffer.length / 1024).toFixed(1)}KB`
      });

      return buffer;

    } catch (error) {
      logger.error('Failed to download image', {
        source: 'imageProcessing',
        error: error.message,
        url: url.substring(0, 100) + '...'
      });
      throw error;
    }
  }

  validateImageSize(buffer, maxSizeMB) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error(`Image size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`);
    }
  }

  generateImagePrompt(message, image) {
    const persona = storage.getPersona();
    const messageContent = message.content || '';
    
    // Base prompt for image analysis
    let prompt = `You are ${persona.name || 'Atlas'}, a Discord bot. A user has shared an image in the chat.`;
    
    if (persona.description) {
      prompt += ` Your personality: ${persona.description}`;
    }

    // Add context from the message
    if (messageContent.trim()) {
      prompt += `\n\nThe user said: "${messageContent}"`;
    }

    // Add channel context
    prompt += `\n\nThis is in the #${message.channel.name} channel. `;
    
    // Instructions for analysis
    prompt += `Please analyze this image and respond naturally as your character would. Consider:
- What do you see in the image?
- How does it relate to the conversation?
- Is there any text to read (OCR)?
- What would be an appropriate reaction?

Respond conversationally, as if you're participating in the Discord chat. Keep it concise but engaging.`;

    return prompt;
  }

  getImageSettings() {
    const llmSettings = storage.getLLMSettings();
    
    return {
      enabled: !!(llmSettings.image_provider && llmSettings.image_model && llmSettings.image_api_key),
      provider: llmSettings.image_provider,
      model: llmSettings.image_model,
      apiKey: llmSettings.image_api_key,
      maxSize: llmSettings.image_max_size || 5,
      quality: llmSettings.image_quality || 2
    };
  }

  // Method to check if image processing is available
  isImageProcessingAvailable() {
    const settings = this.getImageSettings();
    return settings.enabled && this.providers.has(settings.provider);
  }

  // Method to get provider info
  getProviderInfo(providerName) {
    const provider = this.providers.get(providerName);
    return provider ? provider.getInfo() : null;
  }

  // Method to get all available providers
  getAvailableProviders() {
    const providers = {};
    for (const [name, provider] of this.providers) {
      providers[name] = provider.getInfo();
    }
    return providers;
  }

  // Method for testing image processing
  async testImageProcessing(imageUrl, customPrompt) {
    try {
      const settings = this.getImageSettings();
      if (!settings.enabled) {
        throw new Error('Image processing not configured');
      }

      const imageBuffer = await this.downloadImage(imageUrl);
      const provider = this.providers.get(settings.provider);
      
      const prompt = customPrompt || 'What do you see in this image?';
      
      const result = await provider.analyzeImage(imageBuffer, prompt, {
        apiKey: settings.apiKey,
        model: settings.model,
        quality: settings.quality,
        maxTokens: 500
      });

      return {
        success: true,
        analysis: result.content,
        provider: settings.provider,
        model: settings.model
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const imageProcessingService = new ImageProcessingService();

module.exports = imageProcessingService;