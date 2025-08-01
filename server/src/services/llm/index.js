const PromptBuilder = require('./PromptBuilder');
const LLMClient = require('./LLMClient');
const ResponseFormatter = require('./ResponseFormatter');

class LLMService {
  constructor() {
    this.promptBuilder = new PromptBuilder();
    this.llmClient = new LLMClient();
    this.responseFormatter = new ResponseFormatter();
  }

  async generateCharacterResponse(context) {
    try {
      // Build the complete prompt
      const prompt = this.promptBuilder.buildCharacterPrompt(context);
      
      // Get LLM settings
      const llmSettings = context.llmSettings || {};
      
      // Send to LLM
      const rawResponse = await this.llmClient.generateResponse(prompt, llmSettings);
      
      // Format and clean the response
      const formattedResponse = this.responseFormatter.formatCharacterResponse(
        rawResponse, 
        context.characterName
      );
      
      return {
        success: true,
        response: formattedResponse,
        metadata: {
          promptLength: prompt.length,
          originalResponse: rawResponse
        }
      };
    } catch (error) {
      console.error('LLM Service error:', error);
      return {
        success: false,
        error: error.message,
        fallbackResponse: `*${context.characterName || 'Bot'} seems to be having trouble responding right now.*`
      };
    }
  }

  // Future method for different contexts
  async generateCustomResponse(prompt, settings = {}) {
    try {
      const rawResponse = await this.llmClient.generateResponse(prompt, settings);
      return { success: true, response: rawResponse };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LLMService;