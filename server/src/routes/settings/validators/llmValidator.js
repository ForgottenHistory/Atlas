// LLM settings validation rules
const VALIDATION_RULES = {
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
  }
};

/**
 * Validates a single LLM setting value
 * @param {string} key - Setting name
 * @param {any} value - Setting value
 * @returns {Object} - { isValid: boolean, error?: string, validatedValue?: any }
 */
function validateSetting(key, value) {
  const rule = VALIDATION_RULES[key];
  if (!rule) {
    return { isValid: false, error: `Unknown setting: ${key}` };
  }

  // Handle string type (system prompt)
  if (rule.type === 'string') {
    if (typeof value !== 'string') {
      return { isValid: false, error: `${key} must be a string` };
    }
    
    if (rule.maxLength && value.length > rule.maxLength) {
      return { isValid: false, error: rule.description };
    }
    
    return { isValid: true, validatedValue: value };
  }

  // Handle numeric types
  let numValue;
  if (rule.type === 'integer') {
    numValue = parseInt(value);
  } else {
    numValue = parseFloat(value);
  }

  // Check if conversion was successful
  if (isNaN(numValue)) {
    return { isValid: false, error: `${key} must be a valid number` };
  }

  // Special handling for top_k (can be -1 or positive, but not 0)
  if (key === 'top_k') {
    if (numValue !== -1 && numValue <= 0) {
      return { isValid: false, error: rule.description };
    }
  } else {
    // Check range for other numeric settings
    if (numValue < rule.min || numValue > rule.max) {
      return { isValid: false, error: rule.description };
    }
  }

  return { isValid: true, validatedValue: numValue };
}

/**
 * Validates LLM settings object
 * @param {Object} settings - LLM settings to validate
 * @returns {Object} - { error?: string, settings?: Object }
 */
function validateLLMSettings(llmSettings) {
  const errors = [];
  const validatedSettings = {};
  
  console.log('Validating LLM settings:', llmSettings);
  
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
    context_limit: { min: 512, max: 32768, required: false, integer: true }
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
  validateLLMSettings
};

/**
 * Get default LLM settings
 * @returns {Object} - Default LLM settings
 */
function getDefaultLLMSettings() {
  return {
    systemPrompt: '',
    temperature: 0.6,
    top_p: 1,
    repetition_penalty: 1
  };
}

/**
 * Get validation rules for frontend
 * @returns {Object} - Validation rules object
 */
function getValidationRules() {
  return VALIDATION_RULES;
}

module.exports = {
  validateLLMSettings,
  validateSetting,
  getDefaultLLMSettings,
  getValidationRules,
  VALIDATION_RULES
};