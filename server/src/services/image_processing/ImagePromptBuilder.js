const storage = require('../../utils/storage');

class ImagePromptBuilder {
  generateImagePrompt(message, image) {
    const persona = storage.getPersona();
    const messageContent = message.content || '';

    // Base prompt for image analysis
    let prompt = `You are ${persona.name || 'Atlas'}, a Discord bot. A user has shared an image in the chat.`;

    if (persona.description) {
      prompt += ` Your personality: ${persona.description}`;
    }

    // Add context from the message
    if (messageContent.trim()) {
      prompt += `\n\nThe user said: "${messageContent}"`;
    }

    // Add channel context  
    prompt += `\n\nThis is in the #${message.channel.name} channel. `;

    // Instructions for analysis
    prompt += `Please analyze this image and respond naturally as your character would. Consider:
- What do you see in the image?
- How does it relate to the conversation?
- Is there any text to read (OCR)?
- What would be an appropriate reaction?

Respond conversationally, as if you're participating in the Discord chat. Keep it concise but engaging.`;

    return prompt;
  }

  generateCustomPrompt(customText, characterInfo = null) {
    if (!characterInfo) {
      characterInfo = storage.getPersona();
    }

    let prompt = `You are ${characterInfo.name || 'Atlas'}, a Discord bot.`;
    
    if (characterInfo.description) {
      prompt += ` Your personality: ${characterInfo.description}`;
    }

    prompt += `\n\n${customText}`;

    return prompt;
  }

  generateTestPrompt(testType = 'general') {
    const prompts = {
      general: 'What do you see in this image? Describe it in detail.',
      ocr: 'Please read and transcribe any text visible in this image.',
      analysis: 'Analyze this image and provide insights about what you observe.',
      creative: 'Look at this image and tell me a short story about what you see.'
    };

    return prompts[testType] || prompts.general;
  }
}

module.exports = ImagePromptBuilder;