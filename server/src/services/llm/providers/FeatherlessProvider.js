const OpenAI = require('openai');

class FeatherlessProvider {
  constructor() {
    this.name = 'featherless';
    this.client = this.createClient();
    this.defaultModel = 'moonshotai/Kimi-K2-Instruct';
    this.maxTokens = 16384;
  }

  createClient() {
    const apiKey = process.env.FEATHERLESS_API_KEY;
    if (!apiKey) {
      console.warn('FEATHERLESS_API_KEY not found in environment variables');
      return null;
    }

    return new OpenAI({
      baseURL: 'https://api.featherless.ai/v1',
      apiKey: apiKey,
    });
  }

  async generateResponse(prompt, settings = {}) {
    if (!this.client) {
      throw new Error('Featherless client not initialized - check API key');
    }

    try {
      console.log('Making Featherless API call...');
      console.log('Prompt length:', prompt.length);

      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        max_tokens: Math.min(settings.max_tokens || 512, this.maxTokens),
        temperature: settings.temperature || 0.6,
        top_p: settings.top_p || 1,
        messages: [
          { role: 'user', content: prompt }
        ],
      });

      return this.extractContent(response);
    } catch (error) {
      console.error('Featherless API error:', error);
      throw new Error(`Featherless API failed: ${error.message}`);
    }
  }

  extractContent(response) {
    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error('No response choices returned from API');
    }

    const firstChoice = response.choices[0];
    
    // Featherless returns text completion format
    if (firstChoice.text !== undefined) {
      console.log('Successfully extracted content from Featherless');
      return firstChoice.text;
    }
    
    // Fallback for chat completion format
    if (firstChoice.message && firstChoice.message.content !== undefined) {
      return firstChoice.message.content;
    }

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
      supportedParams: ['temperature', 'top_p', 'max_tokens'],
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
    
    return errors;
  }
}

module.exports = FeatherlessProvider;