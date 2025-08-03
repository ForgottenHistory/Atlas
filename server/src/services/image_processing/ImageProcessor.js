const ImagePromptBuilder = require('./ImagePromptBuilder');
const logger = require('../logger/Logger');

class ImageProcessor {
  constructor() {
    this.promptBuilder = new ImagePromptBuilder();
  }

  async processWithProvider(provider, image, message, settings) {
    // Download the image
    const imageBuffer = await this.downloadImage(image.url);

    // Validate image size
    const maxSizeMB = settings.maxSize || 5;
    this.validateImageSize(imageBuffer, maxSizeMB);

    // Generate context-aware prompt
    const prompt = this.promptBuilder.generateImagePrompt(message, image);

    // Analyze the image
    const analysisSettings = {
      apiKey: settings.apiKey,
      model: settings.model,
      quality: settings.quality || 2,
      maxTokens: 1000,
      temperature: 0.7
    };

    return await provider.analyzeImage(imageBuffer, prompt, analysisSettings);
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
}

module.exports = ImageProcessor;