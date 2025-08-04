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

  generateGifPrompt(message, image, frames) {
    const storage = require('../../utils/storage');
    const persona = storage.getPersona();
    const messageContent = message.content || '';

    // Base prompt for GIF analysis
    let prompt = `You are ${persona.name || 'Atlas'}, a Discord bot. A user has shared a GIF in the chat.`;

    if (persona.description) {
      prompt += ` Your personality: ${persona.description}`;
    }

    // Add context from the message
    if (messageContent.trim()) {
      prompt += `\n\nThe user said: "${messageContent}"`;
    }

    // Add channel context  
    prompt += `\n\nThis is in the #${message.channel.name} channel. `;

    // GIF-specific instructions
    prompt += `I'm showing you ${frames.length} key frames from this GIF to help you understand what's happening. `;

    if (frames.length === 1) {
      prompt += `This appears to be a static image or single-frame GIF.`;
    } else if (frames.length === 2) {
      prompt += `The frames show the beginning and middle of the animation.`;
    } else {
      prompt += `The frames are distributed across the animation to show the progression.`;
    }

    prompt += `\n\nPlease analyze this GIF and respond naturally as your character would. Consider:
- What action or movement is happening in the GIF?
- What's the mood or emotion being conveyed?
- How does this relate to the conversation context?
- Is there any text visible in the frames?
- What would be an appropriate reaction to this GIF?

Frame descriptions: ${frames.map(f => f.description).join(', ')}

Respond conversationally, as if you're participating in the Discord chat. Keep it concise but engaging, and acknowledge what you see happening in the animation.`;

    return prompt;
  }
}

module.exports = ImagePromptBuilder;