// LLM settings validation rules
const VALIDATION_RULES = {
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
 * @returns {Object} - { isValid: boolean, error?: string, validatedValue?: number }
 */
function validateSetting(key, value) {
  const rule = VALIDATION_RULES[key];
  if (!rule) {
    return { isValid: false, error: `Unknown setting: ${key}` };
  }

  // Convert value based on type
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
    // Check range for other settings
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
function validateLLMSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return { error: 'Invalid settings object' };
  }

  const validated = {};
  const errors = [];

  // Validate each provided setting
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined || value === null || value === '') {
      continue; // Skip empty values
    }

    const result = validateSetting(key, value);
    if (result.isValid) {
      validated[key] = result.validatedValue;
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return { error: errors.join(', ') };
  }

  // Return validated settings (only non-empty values)
  return { settings: validated };
}

/**
 * Get default LLM settings
 * @returns {Object} - Default LLM settings
 */
function getDefaultLLMSettings() {
  return {
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