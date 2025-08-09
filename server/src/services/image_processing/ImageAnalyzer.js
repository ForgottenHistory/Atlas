const ImageExtractor = require('./ImageExtractor');
const ImageProcessor = require('./ImageProcessor');
const logger = require('../logger/Logger');

class ImageAnalyzer {
  constructor(providerRegistry) {
    this.providerRegistry = providerRegistry;
    this.extractor = new ImageExtractor();
    this.processor = new ImageProcessor();
  }

  async analyzeMessageImages(message, settings) {
    // Extract images from the message
    const images = this.extractor.extractImagesFromMessage(message);

    if (images.length === 0) {
      logger.debug('No images found in message', {
        source: 'imageProcessing',
        messageId: message.id
      });
      return null;
    }

    logger.info('Processing images from Discord message', {
      source: 'imageProcessing',
      messageId: message.id,
      imageCount: images.length,
      provider: settings.provider
    });

    const results = [];

    for (const image of images) {
      try {
        const result = await this.processImage(image, message, settings);
        results.push(result);
      } catch (imageError) {
        logger.error('Failed to process individual image', {
          source: 'imageProcessing',
          imageUrl: image.url,
          error: imageError.message
        });
      }
    }

    return results.length > 0 ? results : null;
  }

  async processImage(image, message, settings) {
    // Validate provider
    const validation = this.providerRegistry.validateProvider(settings.provider, settings);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Get provider and process image
    const provider = this.providerRegistry.getProvider(settings.provider);
    const result = await this.processor.processWithProvider(
      provider, 
      image, 
      message, 
      settings
    );

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
  }

  async testAnalysis(imageUrl, customPrompt, settings) {
    try {
      const validation = this.providerRegistry.validateProvider(settings.provider, settings);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const imageBuffer = await this.processor.downloadImage(imageUrl);
      const provider = this.providerRegistry.getProvider(settings.provider);

      const prompt = customPrompt || 'What do you see in this image?';
      const result = await provider.analyzeImage(imageBuffer, prompt, {
        api_key: settings.api_key,
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

module.exports = ImageAnalyzer;