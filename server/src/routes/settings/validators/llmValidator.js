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
function validateLLMSettings(llmSettings) {
  const errors = [];
  const validatedSettings = {};
  
  console.log('Validating LLM settings:', llmSettings);
  
  // Validate provider (string)
  if (llmSettings.provider !== undefined) {
    if (typeof llmSettings.provider === 'string') {
      validatedSettings.provider = llmSettings.provider.trim();
    } else {
      errors.push('Provider must be a string');
    }
  }
  
  // Validate API key (string)
  if (llmSettings.api_key !== undefined) {
    if (typeof llmSettings.api_key === 'string') {
      // Only store non-empty values
      if (llmSettings.api_key.trim() !== '') {
        validatedSettings.api_key = llmSettings.api_key.trim();
      }
    } else {
      errors.push('API key must be a string');
    }
  }
  
  // Validate model (string)
  if (llmSettings.model !== undefined) {
    if (typeof llmSettings.model === 'string') {
      validatedSettings.model = llmSettings.model.trim();
    } else {
      errors.push('Model must be a string');
    }
  }
  
  // Validate system prompt (string)
  if (llmSettings.systemPrompt !== undefined) {
    if (typeof llmSettings.systemPrompt === 'string') {
      validatedSettings.systemPrompt = llmSettings.systemPrompt;
    } else {
      errors.push('System prompt must be a string');
    }
  }
  
  // Get context limit based on provider
  const getContextLimits = (provider) => {
    switch (provider) {
      case 'openrouter':
        return { min: 512, max: 1000000 }; // OpenRouter supports very large contexts
      case 'featherless':
      default:
        return { min: 512, max: 32768 }; // Conservative default
    }
  };
  
  const contextLimits = getContextLimits(validatedSettings.provider || llmSettings.provider);
  
  // Validate numeric parameters
  const numericFields = {
    temperature: { min: 0, max: 2, required: false },
    top_p: { min: 0.01, max: 1, required: false },
    top_k: { min: -1, max: 1000, required: false, integer: true },
    frequency_penalty: { min: -2, max: 2, required: false },
    presence_penalty: { min: -2, max: 2, required: false },
    repetition_penalty: { min: 0.1, max: 2, required: false },
    min_p: { min: 0, max: 1, required: false },
    max_tokens: { min: 1, max: 8192, required: false, integer: true },
    max_characters: { min: 50, max: 4000, required: false, integer: true },
    context_limit: { min: contextLimits.min, max: contextLimits.max, required: false, integer: true },
    image_max_size: { min: 0.1, max: 50, required: false },
    image_quality: { min: 1, max: 3, required: false, integer: true }
  };
  
  for (const [field, config] of Object.entries(numericFields)) {
    if (llmSettings[field] !== undefined) {
      const value = llmSettings[field];
      
      // Allow empty strings (will be ignored)
      if (value === '' || value === null) {
        continue;
      }
      
      const numValue = config.integer ? parseInt(value) : parseFloat(value);
      
      if (isNaN(numValue)) {
        errors.push(`${field} must be a number`);
        continue;
      }
      
      if (numValue < config.min || numValue > config.max) {
        errors.push(`${field} must be between ${config.min} and ${config.max}`);
        continue;
      }
      
      validatedSettings[field] = numValue;
    }
  }

  // Validate image reading string settings
  const imageStringFields = {
    image_provider: { enum: ['', 'openrouter', 'anthropic', 'openai'] },
    image_model: { maxLength: 200 },
    image_api_key: { maxLength: 500 }
  };

  for (const [field, config] of Object.entries(imageStringFields)) {
    if (llmSettings[field] !== undefined) {
      const value = llmSettings[field];

      if (typeof value !== 'string') {
        errors.push(`${field} must be a string`);
        continue;
      }

      if (config.enum && !config.enum.includes(value)) {
        errors.push(`${field} must be one of: ${config.enum.join(', ')}`);
        continue;
      }

      if (config.maxLength && value.length > config.maxLength) {
        errors.push(`${field} must be under ${config.maxLength} characters`);
        continue;
      }

      // Only store non-empty values
      if (value.trim() !== '') {
        validatedSettings[field] = value.trim();
      }
    }
  }
  
  console.log('Validation results:', { 
    errors, 
    validatedSettings,
    hasErrors: errors.length > 0 
  });
  
  return {
    error: errors.length > 0 ? errors.join(', ') : null,
    settings: validatedSettings
  };
}

module.exports = {
  validateLLMSettings,
  getDefaultLLMSettings,
  VALIDATION_RULES
};