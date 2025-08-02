const LLMService = require('./index');

// Singleton instance
let instance = null;

class LLMServiceSingleton {
  static getInstance() {
    if (!instance) {
      instance = new LLMService();
      console.log('LLM Service singleton instance created');
    }
    return instance;
  }

  // Prevent direct instantiation
  constructor() {
    throw new Error('Use LLMServiceSingleton.getInstance() instead of new LLMServiceSingleton()');
  }
}

module.exports = LLMServiceSingleton;