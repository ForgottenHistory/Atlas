const OpenAI = require('openai');
const logger = require('../../logger/Logger');

class FeatherlessProvider {
  constructor() {
    this.name = 'featherless';
    this.client = this.createClient();
    this.defaultModel = 'moonshotai/Kimi-K2-Instruct';
    this.maxTokens = 16384;
    this.availableModels = null;
    
    if (this.client) {
      logger.success('Featherless provider initialized', {
        source: 'llm',
        provider: this.name,
        defaultModel: this.defaultModel,
        maxTokens: this.maxTokens
      });
    } else {
      logger.error('Featherless provider failed to initialize', {
        source: 'llm',
        provider: this.name,
        reason: 'Missing API key'
      });
    }
  }

  createClient() {
    const apiKey = process.env.FEATHERLESS_API_KEY;
    if (!apiKey) {
      logger.error('FEATHERLESS_API_KEY not found in environment variables', {
        source: 'llm',
        provider: this.name
      });
      return null;
    }

    return new OpenAI({
      baseURL: 'https://api.featherless.ai/v1',
      apiKey: apiKey,
    });
  }

  async fetchAvailableModels() {
    if (!this.client) {
      throw new Error('Featherless client not initialized - check API key');
    }

    try {
      logger.debug('Fetching available models from Featherless API', {
        source: 'llm',
        provider: this.name
      });

      const response = await fetch('https://api.featherless.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.FEATHERLESS_API_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(data);
      if (data.data && Array.isArray(data.data)) {
        this.availableModels = data.data;
        
        logger.info('Successfully fetched available models', {
          source: 'llm',
          provider: this.name,
          modelCount: data.data.length
        });
        
        return data.data;
      } else {
        throw new Error('Invalid response format from models API');
      }
    } catch (error) {
      logger.error('Failed to fetch available models', {
        source: 'llm',
        provider: this.name,
        error: error.message
      });
      throw error;
    }
  }

  async generateResponse(prompt, settings = {}) {
    if (!this.client) {
      throw new Error('Featherless client not initialized - check API key');
    }

    // Determine which model to use
    const modelToUse = settings.model || this.defaultModel;

    try {
      logger.debug('Making Featherless API call', {
        source: 'llm',
        provider: this.name,
        model: modelToUse,
        promptLength: prompt.length,
        settings: {
          temperature: settings.temperature || 0.6,
          top_p: settings.top_p || 1,
          max_tokens: Math.min(settings.max_tokens || 512, this.maxTokens)
        }
      });

      const startTime = Date.now();
      const response = await this.client.chat.completions.create({
        model: modelToUse,
        max_tokens: Math.min(settings.max_tokens || 512, this.maxTokens),
        temperature: settings.temperature || 0.6,
        top_p: settings.top_p || 1,
        messages: [
          { role: 'user', content: prompt }
        ],
      });
      const apiTime = Date.now() - startTime;

      logger.info('Featherless API call completed', {
        source: 'llm',
        provider: this.name,
        model: modelToUse,
        apiTime: `${apiTime}ms`,
        usage: response.usage || 'not provided'
      });

      return this.extractContent(response);
    } catch (error) {
      logger.error('Featherless API error', {
        source: 'llm',
        provider: this.name,
        model: modelToUse,
        error: error.message,
        status: error.status,
        code: error.code
      });
      throw new Error(`Featherless API failed: ${error.message}`);
    }
  }

  extractContent(response) {
    if (!response || !response.choices || response.choices.length === 0) {
      logger.error('Invalid API response structure', {
        source: 'llm',
        provider: this.name,
        hasResponse: !!response,
        hasChoices: !!(response && response.choices),
        choicesLength: response?.choices?.length || 0
      });
      throw new Error('No response choices returned from API');
    }

    const firstChoice = response.choices[0];
    
    // Featherless returns text completion format
    if (firstChoice.text !== undefined) {
      logger.debug('Successfully extracted content from Featherless', {
        source: 'llm',
        provider: this.name,
        contentLength: firstChoice.text.length,
        finishReason: firstChoice.finish_reason
      });
      return firstChoice.text;
    }
    
    // Fallback for chat completion format
    if (firstChoice.message && firstChoice.message.content !== undefined) {
      logger.debug('Extracted content using chat completion format', {
        source: 'llm',
        provider: this.name,
        contentLength: firstChoice.message.content.length
      });
      return firstChoice.message.content;
    }

    logger.error('No content found in API response choice', {
      source: 'llm',
      provider: this.name,
      choiceStructure: Object.keys(firstChoice)
    });
    throw new Error('No content found in API response');
  }

  isAvailable() {
    return this.client !== null;
  }

  getInfo() {
    return {
      name: this.name,
      displayName: 'Featherless AI',
      maxTokens: this.maxTokens,
      defaultModel: this.defaultModel,
      supportedParams: ['model', 'temperature', 'top_p', 'max_tokens'],
      responseFormat: 'text_completion'
    };
  }

  validateSettings(settings) {
    const errors = [];
    
    if (settings.temperature !== undefined) {
      if (settings.temperature < 0 || settings.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }
    
    if (settings.top_p !== undefined) {
      if (settings.top_p < 0.01 || settings.top_p > 1) {
        errors.push('Top P must be between 0.01 and 1');
      }
    }
    
    if (settings.max_tokens !== undefined) {
      if (settings.max_tokens < 1 || settings.max_tokens > this.maxTokens) {
        errors.push(`Max tokens must be between 1 and ${this.maxTokens}`);
      }
    }

    if (settings.model !== undefined) {
      if (typeof settings.model !== 'string' || settings.model.trim().length === 0) {
        errors.push('Model must be a non-empty string');
      }
    }

    if (errors.length > 0) {
      logger.warn('Invalid LLM settings provided', {
        source: 'llm',
        provider: this.name,
        errors: errors,
        providedSettings: settings
      });
    }
    
    return errors;
  }
}

module.exports = FeatherlessProvider;