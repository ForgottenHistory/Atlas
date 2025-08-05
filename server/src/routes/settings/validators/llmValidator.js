/**
 * Get default LLM settings
 * @returns {Object} - Default LLM settings
 */
function getDefaultLLMSettings() {
  return {
    provider: 'featherless',
    systemPrompt: '',
    temperature: 0.6,
    top_p: 1,
    repetition_penalty: 1,
    image_provider: '',
    image_model: '',
    image_api_key: '',
    image_max_size: 5,
    image_quality: 2
  };
}

// LLM settings validation rules
const VALIDATION_RULES = {
  provider: {
    type: 'string',
    enum: ['featherless', 'openrouter'],
    description: 'Provider must be featherless or openrouter'
  },
  api_key: {
    type: 'string',
    maxLength: 500,
    description: 'API key must be under 500 characters'
  },
  systemPrompt: {
    type: 'string',
    maxLength: 8000,
    description: 'System prompt must be under 8000 characters'
  },
  temperature: {
    min: 0,
    max: 2,
    type: 'float',
    description: 'Temperature must be between 0 and 2'
  },
  top_p: {
    min: 0.01,
    max: 1,
    type: 'float',
    description: 'Top P must be between 0.01 and 1'
  },
  top_k: {
    min: -1,
    max: Infinity,
    type: 'integer',
    allowZero: false,
    description: 'Top K must be -1 or a positive integer'
  },
  frequency_penalty: {
    min: -2,
    max: 2,
    type: 'float',
    description: 'Frequency penalty must be between -2 and 2'
  },
  presence_penalty: {
    min: -2,
    max: 2,
    type: 'float',
    description: 'Presence penalty must be between -2 and 2'
  },
  repetition_penalty: {
    min: 0.1,
    max: 2,
    type: 'float',
    description: 'Repetition penalty must be between 0.1 and 2'
  },
  min_p: {
    min: 0,
    max: 1,
    type: 'float',
    description: 'Min P must be between 0 and 1'
  },
  // Image reading validation rules
  image_provider: {
    type: 'string',
    enum: ['', 'openrouter', 'anthropic', 'openai'],
    description: 'Image provider must be openrouter, anthropic, openai, or empty'
  },
  image_model: {
    type: 'string',
    maxLength: 200,
    description: 'Image model name must be under 200 characters'
  },
  image_api_key: {
    type: 'string',
    maxLength: 500,
    description: 'Image API key must be under 500 characters'
  },
  image_max_size: {
    min: 0.1,
    max: 50,
    type: 'float',
    description: 'Image max size must be between 0.1 and 50 MB'
  },
  image_quality: {
    min: 1,
    max: 3,
    type: 'integer',
    description: 'Image quality must be 1, 2, or 3'
  }
};

/**
 * Validates LLM settings object
 * @param {Object} settings - LLM settings to validate
 * @returns {Object} - { error?: string, settings?: Object }
 */
const validateLLMSettings = (settings) => {
  const errors = [];
  
  if (!settings || typeof settings !== 'object') {
    errors.push('LLM settings must be an object');
    return errors;
  }

  // Legacy single-model validation
  if (settings.provider && typeof settings.provider !== 'string') {
    errors.push('Provider must be a string');
  }

  if (settings.model && typeof settings.model !== 'string') {
    errors.push('Model must be a string');
  }

  if (settings.api_key && typeof settings.api_key !== 'string') {
    errors.push('API key must be a string');
  }

  // Multi-model validation
  const multiModelFields = [
    'decision_provider', 'decision_model', 'decision_api_key',
    'conversation_provider', 'conversation_model', 'conversation_api_key'
  ];

  multiModelFields.forEach(field => {
    if (settings[field] !== undefined && typeof settings[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  });

  // Numeric parameter validation
  const numericFields = {
    temperature: { min: 0, max: 2 },
    decision_temperature: { min: 0, max: 2 },
    conversation_temperature: { min: 0, max: 2 },
    top_p: { min: 0.01, max: 1 },
    top_k: { min: 1, max: 100, optional: true },
    frequency_penalty: { min: -2, max: 2, optional: true },
    presence_penalty: { min: -2, max: 2, optional: true },
    repetition_penalty: { min: 0.1, max: 2 },
    min_p: { min: 0, max: 1, optional: true },
    max_characters: { min: 50, max: 4000 },
    context_limit: { min: 512, max: 1000000 },
    max_tokens: { min: 1, max: 4000, optional: true },
    decision_max_tokens: { min: 50, max: 500 },
    conversation_max_tokens: { min: 100, max: 4000 },
    image_max_size: { min: 0.5, max: 20 },
    image_quality: { min: 1, max: 3 }
  };

  Object.entries(numericFields).forEach(([field, validation]) => {
    const value = settings[field];
    
    if (value !== undefined) {
      const numValue = parseFloat(value);
      
      if (isNaN(numValue)) {
        errors.push(`${field} must be a valid number`);
      } else if (numValue < validation.min || numValue > validation.max) {
        errors.push(`${field} must be between ${validation.min} and ${validation.max}`);
      }
    } else if (!validation.optional && value !== undefined) {
      // Only validate if the field is explicitly provided
    }
  });

  // String length validation
  if (settings.systemPrompt && settings.systemPrompt.length > 10000) {
    errors.push('System prompt must be less than 10,000 characters');
  }

  // Image settings validation
  const imageFields = ['image_provider', 'image_model', 'image_api_key'];
  imageFields.forEach(field => {
    if (settings[field] !== undefined && typeof settings[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  });

  // Provider-specific validation
  if (settings.provider === 'openrouter' && settings.api_key && !settings.api_key.startsWith('sk-or-')) {
    errors.push('OpenRouter API key should start with "sk-or-"');
  }

  if (settings.decision_provider === 'openrouter' && settings.decision_api_key && !settings.decision_api_key.startsWith('sk-or-')) {
    errors.push('Decision model OpenRouter API key should start with "sk-or-"');
  }

  if (settings.conversation_provider === 'openrouter' && settings.conversation_api_key && !settings.conversation_api_key.startsWith('sk-or-')) {
    errors.push('Conversation model OpenRouter API key should start with "sk-or-"');
  }

  return errors;
};

const sanitizeLLMSettings = (settings) => {
  const sanitized = { ...settings };
  
  // Remove empty strings and convert numbers
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string' && sanitized[key].trim() === '') {
      delete sanitized[key];
    } else if (typeof sanitized[key] === 'string' && !isNaN(parseFloat(sanitized[key]))) {
      // Convert numeric strings to numbers for numeric fields
      const numericFields = [
        'temperature', 'decision_temperature', 'conversation_temperature',
        'top_p', 'top_k', 'frequency_penalty', 'presence_penalty', 
        'repetition_penalty', 'min_p', 'max_characters', 'context_limit',
        'max_tokens', 'decision_max_tokens', 'conversation_max_tokens',
        'image_max_size', 'image_quality'
      ];
      
      if (numericFields.includes(key)) {
        sanitized[key] = parseFloat(sanitized[key]);
      }
    }
  });

  return sanitized;
};

module.exports = {
  validateLLMSettings,
  getDefaultLLMSettings,
  sanitizeLLMSettings,
  VALIDATION_RULES
};