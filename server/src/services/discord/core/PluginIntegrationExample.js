/**
 * PLUGIN INTEGRATION EXAMPLE
 * 
 * This file shows how to integrate the new plugin system with existing Atlas code.
 * After this integration, adding new tools/actions requires ZERO core file changes!
 */

const PluginSystem = require('./core/PluginSystem');
const logger = require('../logger/Logger');

/**
 * Example: Initialize plugin system in your main Atlas service
 */
async function initializeAtlasWithPlugins(existingAtlasServices) {
  try {
    // Your existing Atlas services
    const {
      discordClient,
      llmService,
      conversationManager,
      responseGenerator,
      messageFilter,
      actionExecutor
    } = existingAtlasServices;

    // Initialize plugin system with Atlas dependencies
    const result = await PluginSystem.initialize({
      discordClient,
      llmService,
      conversationManager,
      responseGenerator,
      messageFilter,
      actionExecutor
    });

    if (result.success) {
      logger.success('Atlas initialized with plugin system', {
        source: 'atlas',
        pluginsLoaded: result.pluginsLoaded
      });
      
      return PluginSystem;
    } else {
      throw new Error(`Plugin system initialization failed: ${result.error}`);
    }

  } catch (error) {
    logger.error('Failed to initialize Atlas with plugins', {
      source: 'atlas',
      error: error.message
    });
    throw error;
  }
}

/**
 * Example: Replace your existing message handler with plugin-enabled version
 */
async function handleDiscordMessage(discordMessage, pluginSystem) {
  try {
    // OLD WAY (what you had before):
    // const result = await messageHandler.processMessage(discordMessage);
    
    // NEW WAY (plugin-enabled):
    const result = await pluginSystem.processMessage(discordMessage);
    
    // Same result format, but now extensible with plugins!
    return result;
    
  } catch (error) {
    logger.error('Message processing failed', {
      source: 'atlas',
      messageId: discordMessage.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Example: How to add a new tool plugin with ZERO core changes
 */
function addNewChannelSearchTool() {
  /*
  
  Step 1: Create the tool class in plugins/tools/ChannelSearchTool.js
  
  const Tool = require('../interfaces/Tool');
  
  class ChannelSearchTool extends Tool {
    async execute(context) {
      // Your search logic here
      return this.success({ results: [...] });
    }
  }
  
  Step 2: Add to PluginConfiguration.js (ONLY file that needs changes!)
  
  channel_search: {
    type: 'tool',
    handler: ChannelSearchTool,
    triggers: ['search_request', 'find_message'],
    dependencies: ['discordClient'],
    config: { maxResults: 10 }
  }
  
  Step 3: That's it! The tool is now available automatically.
  No changes to:
  - DecisionPipeline
  - MessagePipeline  
  - ToolExecutor
  - ActionRouter
  - Or ANY core files!
  
  */
  
  logger.info('New tool can be added by only modifying PluginConfiguration.js', {
    source: 'example'
  });
}

/**
 * Example: How to add a new action plugin with ZERO core changes
 */
function addNewDelayedResponseAction() {
  /*
  
  Step 1: Create action class in plugins/actions/DelayedResponseAction.js
  
  const Action = require('../interfaces/Action');
  
  class DelayedResponseAction extends Action {
    async execute(context) {
      // Schedule delayed response
      setTimeout(() => {
        // Send response later
      }, context.delay);
      
      return this.success({ scheduled: true });
    }
  }
  
  Step 2: Add to PluginConfiguration.js (ONLY file that needs changes!)
  
  delayed_response: {
    type: 'action',
    handler: DelayedResponseAction,
    triggers: ['delayed_respond'],
    dependencies: ['discordClient', 'scheduler'],
    config: { maxDelay: 300000 }
  }
  
  Step 3: That's it! Available in decision prompts automatically.
  
  */
  
  logger.info('New action can be added by only modifying PluginConfiguration.js', {
    source: 'example'
  });
}

/**
 * Example: Hot-reload a plugin during development
 */
async function hotReloadPlugin(pluginName) {
  try {
    const result = await PluginSystem.reloadPlugin(pluginName);
    
    if (result.success) {
      logger.success('Plugin reloaded successfully', {
        source: 'atlas',
        pluginName
      });
    } else {
      logger.error('Plugin reload failed', {
        source: 'atlas', 
        pluginName,
        error: result.error
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Hot reload error', {
      source: 'atlas',
      pluginName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Example: Get system status for monitoring/debugging
 */
function getSystemStatus() {
  const status = PluginSystem.getStatus();
  
  logger.info('Atlas Plugin System Status', {
    source: 'atlas',
    initialized: status.initialized,
    pluginsLoaded: status.pluginLoader.loadedCount,
    pluginsFailed: status.pluginLoader.failedCount,
    successRate: status.pluginLoader.successRate,
    availableDependencies: status.availableDependencies
  });
  
  return status;
}

/**
 * Example: Testing tools manually (great for development)
 */
async function testProfileLookupTool() {
  try {
    const result = await PluginSystem.executeToolManually('profile_lookup', {
      message: { content: 'profile john', author: { username: 'test' } },
      targetUser: 'john'
    });
    
    logger.info('Manual tool test completed', {
      source: 'atlas',
      toolName: 'profile_lookup',
      success: result.success,
      data: result.data
    });
    
    return result;
  } catch (error) {
    logger.error('Manual tool test failed', {
      source: 'atlas',
      error: error.message
    });
    throw error;
  }
}

/**
 * INTEGRATION SUMMARY:
 * 
 * 1. Replace message handler with PluginSystem.processMessage()
 * 2. Initialize PluginSystem.initialize() with your existing services
 * 3. Add new tools/actions by only editing PluginConfiguration.js
 * 4. Use hot-reload for development
 * 5. Monitor with getStatus()
 * 
 * ZERO CORE FILE CHANGES needed to add new functionality!
 */

module.exports = {
  initializeAtlasWithPlugins,
  handleDiscordMessage,
  addNewChannelSearchTool,
  addNewDelayedResponseAction,
  hotReloadPlugin,
  getSystemStatus,
  testProfileLookupTool
};

/**
 * BACKWARDS COMPATIBILITY:
 * 
 * The new plugin system is designed to work alongside your existing Atlas code.
 * You can migrate gradually:
 * 
 * Phase 1: Use new system for message processing (recommended)
 * Phase 2: Migrate existing tools to plugins (optional)  
 * Phase 3: Migrate existing actions to plugins (optional)
 * 
 * The ProfileLookupTool and ResponseAction plugins are ready to replace
 * the existing implementations when you're ready.
 */