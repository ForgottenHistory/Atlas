const logger = require('../../logger/Logger');

class TypingSimulator {
  async simulateTyping(channel, durationMs = null) {
    try {
      // Realistic typing duration based on response length estimate
      const duration = durationMs || this.calculateTypingDuration();
      
      await channel.sendTyping();
      
      // Keep typing indicator alive for the duration
      if (duration > 5000) {
        const intervals = Math.floor(duration / 5000);
        for (let i = 0; i < intervals; i++) {
          setTimeout(() => {
            channel.sendTyping().catch(() => {}); // Silent fail
          }, (i + 1) * 5000);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, duration));
      
      logger.debug('Typing simulation completed', {
        source: 'discord',
        duration: duration,
        channel: channel.name
      });
    } catch (error) {
      logger.warn('Typing simulation failed', {
        source: 'discord',
        error: error.message
      });
    }
  }

  calculateTypingDuration() {
    // Simulate realistic human typing speed
    // Average: 40 WPM = ~200 characters per minute = ~3.3 chars/second
    const estimatedResponseLength = 50 + Math.random() * 150; // 50-200 chars
    const typingSpeed = 3 + Math.random() * 2; // 3-5 chars/second
    const baseDuration = (estimatedResponseLength / typingSpeed) * 1000;
    
    // Add some human variation (pauses, thinking)
    const humanVariation = 1000 + Math.random() * 2000; // 1-3 second thinking pause
    
    return Math.min(baseDuration + humanVariation, 8000); // Max 8 seconds
  }

  // Calculate typing duration based on actual text length
  calculateTypingDurationForText(text) {
    if (!text || text.length === 0) {
      return this.calculateTypingDuration();
    }

    const textLength = text.length;
    const typingSpeed = 3.5 + Math.random() * 1.5; // 3.5-5 chars/second
    const baseDuration = (textLength / typingSpeed) * 1000;
    
    // Add thinking pauses for longer texts
    const thinkingPauses = Math.floor(textLength / 100) * (500 + Math.random() * 1000);
    
    return Math.min(baseDuration + thinkingPauses, 10000); // Max 10 seconds
  }

  // Start typing and return a function to stop it
  startContinuousTyping(channel) {
    let isTyping = true;
    
    const typingLoop = async () => {
      while (isTyping) {
        try {
          await channel.sendTyping();
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          // Stop on error
          isTyping = false;
        }
      }
    };
    
    typingLoop();
    
    // Return stop function
    return () => {
      isTyping = false;
    };
  }

  // Simulate typing with custom patterns
  async simulateTypingPattern(channel, pattern = 'normal') {
    const patterns = {
      quick: () => 1000 + Math.random() * 1000, // 1-2 seconds
      normal: () => this.calculateTypingDuration(),
      slow: () => 3000 + Math.random() * 3000, // 3-6 seconds
      thinking: () => 5000 + Math.random() * 5000, // 5-10 seconds
      burst: () => {
        // Quick bursts with pauses
        const bursts = 2 + Math.floor(Math.random() * 3); // 2-4 bursts
        return bursts * (500 + Math.random() * 500); // Each burst 0.5-1 second
      }
    };

    const getDuration = patterns[pattern] || patterns.normal;
    await this.simulateTyping(channel, getDuration());
  }
}

module.exports = TypingSimulator;