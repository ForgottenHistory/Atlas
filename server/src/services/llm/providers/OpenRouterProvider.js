const logger = require('../../logger/Logger');

class OpenRouterProvider {
  constructor() {
    this.name = 'openrouter';
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.maxImageSize = 50 * 1024 * 1024; // 50MB

    logger.info('OpenRouter provider initialized', {
      source: 'llm',
      provider: this.name,
      baseURL: this.baseURL
    });
  }

  isAvailable(apiKey) {
    return !!(apiKey && apiKey.trim());
  }

  async analyzeImage(imageBuffer, prompt, settings = {}) {
    if (!this.isAvailable(settings.apiKey)) {
      throw new Error('OpenRouter API key not provided');
    }

    try {
      logger.debug('Starting image analysis with OpenRouter', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        imageSize: imageBuffer.length,
        promptLength: prompt.length
      });

      // Convert image buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.detectMimeType(imageBuffer);
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      // Prepare the request
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: this.getImageDetail(settings.quality)
              }
            }
          ]
        }
      ];

      const requestBody = {
        model: settings.model || 'anthropic/claude-3.5-sonnet',
        messages: messages,
        max_tokens: settings.maxTokens || 1000,
        temperature: settings.temperature || 0.7
      };

      // LOG THE FULL PROMPT
      logger.info('Vision prompt generated for image analysis', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        promptLength: prompt.length,
        imageSize: `${(imageBuffer.length / 1024).toFixed(1)}KB`,
        mimeType: mimeType,
        quality: this.getImageDetail(settings.quality),
        fullPrompt: prompt,
        settings: {
          max_tokens: settings.maxTokens || 1000,
          temperature: settings.temperature || 0.7
        }
      });

      const startTime = Date.now();
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://atlas-bot.local',
          'X-Title': 'Atlas Discord Bot'
        },
        body: JSON.stringify(requestBody)
      });

      const apiTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      // Extract and log the response
      const extractedResult = this.extractContent(data);

      // LOG THE FULL RESPONSE
      logger.info('Vision response received from image analysis', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        responseLength: extractedResult.content.length,
        apiTime: `${apiTime}ms`,
        usage: data.usage || 'not provided',
        finishReason: extractedResult.finishReason,
        fullResponse: extractedResult.content
      });

      logger.success('Image analysis completed', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        apiTime: `${apiTime}ms`,
        usage: data.usage || 'not provided'
      });

      return extractedResult;

    } catch (error) {
      logger.error('OpenRouter image analysis failed', {
        source: 'llm',
        provider: this.name,
        error: error.message,
        model: settings.model,
        promptPreview: prompt.substring(0, 200) + '...'
      });
      throw error;
    }
  }

  async analyzeMultipleImages(frames, prompt, settings = {}) {
    if (!this.isAvailable(settings.apiKey)) {
      throw new Error('OpenRouter API key not provided');
    }

    try {
      logger.debug('Starting multi-frame image analysis with OpenRouter', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        frameCount: frames.length,
        promptLength: prompt.length
      });

      // Convert all frame buffers to base64
      const imageContents = frames.map((frame, index) => {
        const base64Image = frame.buffer.toString('base64');
        const mimeType = this.detectMimeType(frame.buffer);
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        return {
          type: 'image_url',
          image_url: {
            url: dataUrl,
            detail: this.getImageDetail(settings.quality)
          }
        };
      });

      // Prepare the request with text first, then all images
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            ...imageContents
          ]
        }
      ];

      const requestBody = {
        model: settings.model || 'anthropic/claude-3.5-sonnet',
        messages: messages,
        max_tokens: settings.maxTokens || 1500,
        temperature: settings.temperature || 0.7
      };

      // LOG THE FULL PROMPT
      logger.info('Multi-frame vision prompt generated', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        promptLength: prompt.length,
        frameCount: frames.length,
        totalImageSize: `${frames.reduce((sum, f) => sum + f.buffer.length, 0) / 1024}KB`,
        frameDescriptions: frames.map(f => f.description),
        quality: this.getImageDetail(settings.quality),
        fullPrompt: prompt,
        settings: {
          max_tokens: settings.maxTokens || 1500,
          temperature: settings.temperature || 0.7
        }
      });

      const startTime = Date.now();
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://atlas-bot.local',
          'X-Title': 'Atlas Discord Bot'
        },
        body: JSON.stringify(requestBody)
      });

      const apiTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const extractedResult = this.extractContent(data);

      // LOG THE FULL RESPONSE
      logger.info('Multi-frame vision response received', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        responseLength: extractedResult.content.length,
        apiTime: `${apiTime}ms`,
        usage: data.usage || 'not provided',
        finishReason: extractedResult.finishReason,
        frameCount: frames.length,
        fullResponse: extractedResult.content
      });

      logger.success('Multi-frame image analysis completed', {
        source: 'llm',
        provider: this.name,
        model: settings.model,
        apiTime: `${apiTime}ms`,
        usage: data.usage || 'not provided',
        frameCount: frames.length
      });

      return extractedResult;

    } catch (error) {
      logger.error('OpenRouter multi-frame image analysis failed', {
        source: 'llm',
        provider: this.name,
        error: error.message,
        model: settings.model,
        frameCount: frames.length,
        promptPreview: prompt.substring(0, 200) + '...'
      });
      throw error;
    }
  }

  async fetchAvailableModels(apiKey) {
    if (!apiKey) {
      throw new Error('API key required to fetch models');
    }

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Filter for vision-capable models
      const visionModels = data.data.filter(model =>
        model.architecture?.input_modalities?.includes('image') ||
        model.name.toLowerCase().includes('vision') ||
        model.id.toLowerCase().includes('vision') ||
        model.description.toLowerCase().includes('vision') ||
        model.description.toLowerCase().includes('image')
      );

      logger.info('Fetched OpenRouter vision models', {
        source: 'llm',
        provider: this.name,
        totalModels: data.data.length,
        visionModels: visionModels.length
      });

      return visionModels;
    } catch (error) {
      logger.error('Failed to fetch OpenRouter models', {
        source: 'llm',
        provider: this.name,
        error: error.message
      });
      throw error;
    }
  }

  detectMimeType(buffer) {
    // Check for common image file signatures
    if (buffer.length < 4) return 'application/octet-stream';

    const header = buffer.slice(0, 4);

    // PNG: 89 50 4E 47
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return 'image/png';
    }

    // JPEG: FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return 'image/jpeg';
    }

    // GIF: 47 49 46 38
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
      return 'image/gif';
    }

    // WebP: check for WEBP in bytes 8-11
    if (buffer.length >= 12) {
      const webpHeader = buffer.slice(8, 12);
      if (webpHeader.toString() === 'WEBP') {
        return 'image/webp';
      }
    }

    // Default to JPEG if we can't detect
    return 'image/jpeg';
  }

  getImageDetail(quality) {
    // Map our quality settings to OpenAI-style detail levels
    switch (parseInt(quality)) {
      case 1: return 'low';    // Fast, less detailed
      case 2: return 'auto';   // Automatic selection
      case 3: return 'high';   // Detailed analysis
      default: return 'auto';
    }
  }

  extractContent(response) {
    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error('No response choices returned from OpenRouter API');
    }

    const firstChoice = response.choices[0];

    if (firstChoice.message && firstChoice.message.content) {
      return {
        content: firstChoice.message.content,
        usage: response.usage,
        model: response.model,
        finishReason: firstChoice.finish_reason
      };
    }

    throw new Error('No content found in API response');
  }

  validateImageSize(buffer, maxSizeMB = 20) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error(`Image size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`);
    }
    return true;
  }

  getInfo() {
    return {
      name: this.name,
      displayName: 'OpenRouter',
      supportsImages: true,
      maxImageSize: this.maxImageSize,
      supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      qualityLevels: [
        { value: 1, label: 'Low (Fast)' },
        { value: 2, label: 'Auto (Balanced)' },
        { value: 3, label: 'High (Detailed)' }
      ]
    };
  }

  validateSettings(settings) {
    const errors = [];

    if (!settings.apiKey || settings.apiKey.trim() === '') {
      errors.push('API key is required');
    }

    if (!settings.model || settings.model.trim() === '') {
      errors.push('Model selection is required');
    }

    if (settings.maxTokens !== undefined) {
      if (settings.maxTokens < 1 || settings.maxTokens > 4000) {
        errors.push('Max tokens must be between 1 and 4000');
      }
    }

    if (settings.temperature !== undefined) {
      if (settings.temperature < 0 || settings.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    return errors;
  }
}

module.exports = OpenRouterProvider;