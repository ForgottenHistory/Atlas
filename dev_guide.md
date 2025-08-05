# Atlas Development Guide

## Project Overview

Atlas is an autonomous Discord bot that makes human-like decisions about when and how to engage in conversations. Unlike traditional command-driven bots, Atlas analyzes context and decides whether to respond, react, ignore, or perform other actions based on its character persona and social context.

## System Architecture

### Core Systems

#### 1. Message Processing Pipeline
```
Discord Message → MessageListener → MessageProcessor → DecisionMaker → ActionExecutor → Discord Action
```

**Key Components:**
- **MessageListener**: Receives raw Discord messages
- **MessageProcessor**: Filters, batches, and enriches messages with context
- **DecisionMaker**: Uses LLM to decide what action to take
- **ActionExecutor**: Executes the chosen action (respond, react, ignore, etc.)

#### 2. LLM Service Architecture
```
LLM Request → RequestQueue → Provider (OpenRouter/Featherless) → Response Processing → Action
```

**Key Components:**
- **RequestQueue**: Manages concurrent requests and rate limiting
- **Providers**: Pluggable LLM providers (OpenRouter, Featherless)
- **DecisionEngine**: Specialized prompts for decision-making vs response generation
- **Multi-LLM Support**: Different models for different tasks

#### 3. Image Processing System
```
Image/GIF → ImageExtractor → ImageAnalyzer → LLM Vision → Analysis Storage
```

**Key Components:**
- **GifFrameExtractor**: Extracts key frames from GIFs
- **ImageAnalyzer**: Routes to appropriate vision models
- **ImagePromptBuilder**: Creates context-aware prompts for vision analysis

#### 4. Frontend-Backend Communication
```
React Frontend ↔ Socket.IO ↔ Express Backend ↔ Discord Services
```

**Real-time Features:**
- Live conversation monitoring
- Queue status updates
- Settings synchronization
- Activity logging

## Data Flow Patterns

### 1. Message Processing Flow
1. **Reception**: Discord.js receives message
2. **Filtering**: MessageFilter removes bot messages, applies ignore rules
3. **Batching**: MessageBatcher groups rapid successive messages
4. **Context Building**: ConversationHistory provides recent context
5. **Image Processing**: If images present, analyze with vision models
6. **Decision Making**: LLM decides action with full context
7. **Action Execution**: ActionExecutor performs chosen action

### 2. Settings Flow
1. **Frontend Change**: User modifies setting in UI
2. **Validation**: Backend validates setting structure
3. **Storage**: Persistent storage in JSON files
4. **Distribution**: Socket.IO broadcasts changes to all clients
5. **Service Update**: Relevant services reload configurations

### 3. Queue Management Flow
1. **Request Submission**: Service submits LLM request to queue
2. **Priority Sorting**: Queue prioritizes by request type (decision > response)
3. **Concurrency Control**: Respects global and per-type limits
4. **Provider Selection**: Routes to appropriate LLM provider
5. **Response Processing**: Formats and validates response
6. **Stats Collection**: Updates performance metrics

## Code Standards

### File Organization
- **Single Responsibility**: Each file has one clear purpose
- **Service Separation**: Discord, LLM, Image Processing as separate services  
- **Layered Architecture**: Routes → Services → Utilities
- **Configuration Isolation**: Settings in dedicated modules

### Naming Conventions
```javascript
// Classes: PascalCase
class MessageProcessor {}

// Files: PascalCase for classes, camelCase for utilities
MessageProcessor.js
socketService.js

// Functions: camelCase
function processMessage() {}

// Constants: UPPER_SNAKE_CASE
const MAX_QUEUE_SIZE = 100;
```

### Error Handling
```javascript
// Always use try-catch for async operations
try {
  const result = await llmService.generateDecision(prompt);
  return result;
} catch (error) {
  logger.error('Decision generation failed', { error: error.message });
  throw new Error(`Decision failed: ${error.message}`);
}
```

### Logging Patterns
```javascript
// Structured logging with context
logger.info('Message processed successfully', {
  source: 'discord',
  messageId: message.id,
  action: 'respond',
  processingTime: '150ms'
});
```

## Development Patterns

### 1. Service Injection Pattern
Services are injected rather than required directly in business logic:
```javascript
// Good: Dependency injection
class MessageHandler {
  constructor(llmService, discordService) {
    this.llmService = llmService;
    this.discordService = discordService;
  }
}

// Avoid: Hard dependencies
const llmService = require('../services/llm');
```

### 2. Configuration Management
```javascript
// Settings are loaded from persistent storage
const settings = storage.getLLMSettings();

// Changes are validated before applying
const validator = require('./validators/llmValidator');
if (!validator.validate(newSettings)) {
  throw new Error('Invalid settings');
}
```

### 3. Queue-Based Processing
All LLM requests go through queues for better resource management:
```javascript
// Queue requests instead of direct API calls
const decision = await llmService.queueDecisionRequest(prompt, settings);
```

### 4. Context-Aware Operations
Operations include full context for better decision making:
```javascript
const context = {
  channelName: message.channel.name,
  serverName: message.guild.name,
  conversationHistory: recentMessages,
  activityLevel: 'high',
  lastAction: 'responded',
  hasImages: attachments.length > 0
};
```

## Key Architectural Decisions

### 1. Autonomous Decision Making
- Bot analyzes messages and decides whether to engage
- Uses LLM for decision-making, not just response generation  
- LLMs for decision is very good at conversation flow, timing, and social context

### 2. Multi-Modal Processing
- Text and image analysis integrated
- GIF frame extraction for animated content
- Context-aware prompts for vision models

### 3. Real-Time Monitoring
- Live dashboard shows bot's decision-making process
- Queue monitoring for performance optimization
- Activity logging for debugging and analytics

### 4. Modular LLM Integration
- Provider-agnostic architecture
- Easy to add new LLM providers
- Different models for different tasks (decision vs response)

## Extension Points

### Adding New LLM Providers
1. Create provider class in `services/llm/providers/`
2. Implement required methods: `generateText()`, `generateVision()`
3. Register in provider registry
4. Add configuration UI components

### Adding New Action Types
1. Create action class in `services/discord/actions/`
2. Implement `execute()` method
3. Register in ActionRouter
4. Update decision prompts to include new action

## Development Workflow

### Making Changes
1. **Identify Impact**: What systems are affected?
2. **Small Increments**: Change one small thing at a time
3. **Test Immediately**: Verify before moving to next change
4. **Context Preservation**: Keep related changes together

## Common Pitfalls

### 1. Service Dependencies
- Avoid circular dependencies between services
- Use dependency injection for testability
- Keep service boundaries clear

### 2. Queue Management
- Don't bypass queues for "urgent" requests
- Monitor queue depth and processing times
- Handle rate limiting gracefully

### 3. Context Management
- Don't store large context objects in memory indefinitely
- Clean up conversation history periodically
- Balance context richness with performance

### 4. Error Propagation
- Don't let single failures crash the entire bot
- Graceful degradation when services are unavailable
- Clear error messages for debugging
