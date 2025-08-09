const ImagePromptBuilder = require('./ImagePromptBuilder');
const GifFrameExtractor = require('./GifFrameExtractor');
const logger = require('../logger/Logger');

class ImageProcessor {
  constructor() {
    this.promptBuilder = new ImagePromptBuilder();
    this.gifExtractor = new GifFrameExtractor();
  }

  async processWithProvider(provider, image, message, settings) {
    // Check if this is a GIF that needs frame extraction
    if (image.isGif) {
      return await this.processGifWithProvider(provider, image, message, settings);
    } else {
      return await this.processSingleImageWithProvider(provider, image, message, settings);
    }
  }

  async processGifWithProvider(provider, image, message, settings) {
    // Download the GIF
    const gifBuffer = await this.downloadImage(image.url);

    // Validate it's actually a GIF
    if (!this.gifExtractor.isGif(gifBuffer)) {
      logger.warn('File marked as GIF but not valid GIF format, processing as static image', {
        source: 'imageProcessing',
        url: image.url.substring(0, 100) + '...'
      });
      return await this.processSingleImageWithProvider(provider, image, message, settings);
    }

    // Validate GIF for processing
    const validation = await this.gifExtractor.validateGif(gifBuffer);
    if (!validation.isValid) {
      throw new Error(`Invalid GIF: ${validation.issues.join(', ')}`);
    }

    // Extract frames based on settings
    const frameCount = settings.gifFrameCount || 2; // Default to 2 frames
    const frames = await this.extractGifFrames(gifBuffer, frameCount);

    logger.info('Processing GIF with multiple frames', {
      source: 'imageProcessing',
      framesExtracted: frames.length,
      frameCount: frameCount,
      gifMetadata: validation.metadata
    });

    // Generate multi-frame prompt
    const prompt = this.promptBuilder.generateGifPrompt(message, image, frames);

    // Analyze the frames with vision model
    const analysisSettings = {
      api_key: settings.api_key,
      model: settings.model,
      quality: settings.quality || 2,
      maxTokens: Math.min(1500, (settings.maxTokens || 1000) + (frames.length * 200)), // More tokens for multiple frames
      temperature: 0.7
    };

    return await provider.analyzeMultipleImages(frames, prompt, analysisSettings);
  }

  async processSingleImageWithProvider(provider, image, message, settings) {
    // Download the image
    const imageBuffer = await this.downloadImage(image.url);

    // Validate image size
    const maxSizeMB = settings.maxSize || 5;
    this.validateImageSize(imageBuffer, maxSizeMB);

    // Generate context-aware prompt
    const prompt = this.promptBuilder.generateImagePrompt(message, image);

    // Analyze the image
    const analysisSettings = {
      api_key: settings.api_key,
      model: settings.model,
      quality: settings.quality || 2,
      maxTokens: settings.maxTokens || 1000,
      temperature: 0.7
    };

    return await provider.analyzeImage(imageBuffer, prompt, analysisSettings);
  }

  async extractGifFrames(gifBuffer, frameCount) {
    try {
      let frames = [];

      if (frameCount <= 1) {
        // Just get first frame
        const firstFrame = await this.gifExtractor.extractSingleFrame(gifBuffer, 0);
        frames = [firstFrame];
      } else if (frameCount === 2) {
        // Get first and middle frames (default behavior)
        frames = await this.gifExtractor.extractKeyFrames(gifBuffer);
      } else {
        // Extract multiple frames evenly distributed
        frames = await this.extractDistributedFrames(gifBuffer, frameCount);
      }

      logger.debug('GIF frames extracted', {
        source: 'imageProcessing',
        requestedFrames: frameCount,
        extractedFrames: frames.length,
        frameDescriptions: frames.map(f => f.description)
      });

      return frames;
    } catch (error) {
      logger.error('Failed to extract GIF frames', {
        source: 'imageProcessing',
        error: error.message,
        requestedFrames: frameCount
      });
      throw error;
    }
  }

  async extractDistributedFrames(gifBuffer, frameCount) {
    const sharp = require('sharp');
    const metadata = await sharp(gifBuffer, { animated: true }).metadata();
    const totalFrames = metadata.pages || 1;

    if (totalFrames <= frameCount) {
      // Extract all available frames
      const frames = [];
      for (let i = 0; i < totalFrames; i++) {
        const frame = await this.gifExtractor.extractSingleFrame(gifBuffer, i);
        frame.description = i === 0 ? 'first_frame' : 
                           i === totalFrames - 1 ? 'last_frame' : 
                           `frame_${i + 1}`;
        frames.push(frame);
      }
      return frames;
    }

    // Distribute frames evenly across the GIF
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
      const frameIndex = Math.floor((i / (frameCount - 1)) * (totalFrames - 1));
      const frame = await this.gifExtractor.extractSingleFrame(gifBuffer, frameIndex);
      
      if (i === 0) frame.description = 'first_frame';
      else if (i === frameCount - 1) frame.description = 'last_frame';
      else frame.description = `frame_${i + 1}`;
      
      frames.push(frame);
    }

    return frames;
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