# Atlas Plugin System Integration Guide

## 🎉 Integration Complete!

The Atlas plugin system has been successfully integrated with your existing codebase. You can now add new tools and actions **without modifying any core files**!

## 📋 What's New

### ✅ **Backwards Compatible**
- Your existing Atlas bot continues to work exactly as before
- All existing features preserved
- No breaking changes

### ✅ **Plugin System Available**
- ProfileLookupTool converted to plugin architecture
- ResponseAction converted to plugin architecture  
- Plugin system runs alongside legacy system
- Easy toggle between plugin and legacy modes

### ✅ **Zero Core Changes for New Features**
- Add new tools by editing only `PluginConfiguration.js`
- Add new actions by editing only `PluginConfiguration.js`
- Hot-reload plugins during development

## 🚀 Quick Start

### 1. **Plugin System is Enabled by Default**

The plugin system is automatically enabled when Atlas starts. Check status:

```bash
curl http://localhost:3001/api/bot/plugins/status
```

Response:
```json
{
  "success": true,
  "status": {
    "enabled": true,
    "initialized": true,
    "active": true,
    "stats": { ... }
  }
}
```

### 2. **View Available Tools**

```bash
curl http://localhost:3001/api/bot/tools
```

Response:
```json
{
  "success": true,
  "tools": {
    "legacy": ["profile_lookup"],
    "plugins": ["profile_lookup", "respond", "reply"]
  }
}
```

### 3. **Monitor Plugin Activity**

```bash
curl http://localhost:3001/api/bot/stats
```

The stats now include plugin system information alongside existing metrics.

## 🔧 Managing the Plugin System

### Enable Plugin System (if disabled)
```bash
curl -X POST http://localhost:3001/api/bot/plugins/enable
```

### Disable Plugin System (use legacy mode)
```bash
curl -X POST http://localhost:3001/api/bot/plugins/disable
```

### Get Plugin Statistics
```bash
curl http://localhost:3001/api/bot/tools/stats
```

## 📝 Adding New Plugins

### Adding a New Tool (Zero Core Changes!)

**Step 1:** Create the tool class in `plugins/tools/ChannelSearchTool.js`:

```javascript
const Tool = require('../interfaces/Tool');

class ChannelSearchTool extends Tool {
  async execute(context) {
    // Your search logic here
    const results = await this.searchChannels(context.query);
    return this.success({ results });
  }
  
  async shouldExecute(context) {
    return context.message.content.includes('search');
  }
  
  // ... implement your tool logic
}

module.exports = ChannelSearchTool;
```

**Step 2:** Add to `plugins/PluginConfiguration.js` (ONLY file to edit!):

```javascript
const ChannelSearchTool = require('./tools/ChannelSearchTool');

// Add this to PLUGIN_DEFINITIONS:
channel_search: {
  type: 'tool',
  handler: ChannelSearchTool,
  triggers: ['search_request', 'find_message'],
  dependencies: ['discordClient'],
  config: { maxResults: 10 }
}
```

**Step 3:** Restart Atlas. That's it! Your new tool is automatically:
- Registered in the plugin system
- Available for decision-making
- Included in tool statistics
- Ready for use

### Adding a New Action (Zero Core Changes!)

**Step 1:** Create action class in `plugins/actions/DelayedResponseAction.js`:

```javascript
const Action = require('../interfaces/Action');

class DelayedResponseAction extends Action {
  async execute(context) {
    const delay = context.decision.delay || 30000;
    
    setTimeout(async () => {
      await context.originalMessage.channel.send(context.decision.response);
    }, delay);
    
    return this.success({ scheduled: true, delay });
  }
}

module.exports = DelayedResponseAction;
```

**Step 2:** Add to `plugins/PluginConfiguration.js`:

```javascript
delayed_response: {
  type: 'action',
  handler: DelayedResponseAction,
  triggers: ['delayed_respond'],
  dependencies: ['discordClient'],
  config: { maxDelay: 300000 }
}
```

**Step 3:** The action is now available in decision prompts automatically!

## 🔄 Migration Strategies

### Strategy 1: Gradual Migration (Recommended)
- ✅ Plugin system runs alongside legacy (current state)
- Use new plugin system for new features
- Migrate existing tools/actions when convenient
- Zero risk approach

### Strategy 2: Full Plugin Mode
- Disable legacy system entirely
- Convert all existing tools to plugins
- Maximum plugin system benefits
- Requires more testing

### Strategy 3: Legacy Mode Only
- Disable plugin system if needed
- Use existing Atlas functionality
- Fallback option for any issues

## 🎯 Current Plugin Status

### ✅ **Converted to Plugins:**
- **ProfileLookupTool** - Fully converted, maintains all functionality
- **ResponseAction** - Handles normal message responses
- **ReplyAction** - Uses same handler as ResponseAction with different config

### 🔄 **Available for Migration:**
- **ReactionAction** - Add emoji reactions
- **IgnoreAction** - Ignore messages 
- **StatusAction** - Change bot status
- **Other custom tools** - Any existing tools you have

### 📋 **Migration Template Available:**
Use `PluginIntegrationExample.js` as a reference for converting existing tools/actions.

## 🐛 Troubleshooting

### Plugin System Not Starting
1. Check logs for initialization errors
2. Verify all plugin dependencies are available
3. Try disabling and re-enabling: `POST /api/bot/plugins/disable` then `POST /api/bot/plugins/enable`

### Plugin Not Executing
1. Check plugin triggers in `PluginConfiguration.js`
2. Verify `shouldExecute()` method logic
3. Check plugin dependencies are injected correctly

### Fallback to Legacy
- Plugin system automatically falls back to legacy mode on errors
- Check `/api/bot/plugins/status` to see current mode
- Review logs for specific error messages

## 📊 Monitoring

### Key Endpoints:
- `/api/bot/plugins/status` - Plugin system status
- `/api/bot/tools` - Available tools
- `/api/bot/tools/stats` - Tool execution statistics  
- `/api/bot/stats` - Comprehensive stats including plugins

### Log Monitoring:
- Plugin system logs with `source: 'plugin_system'`
- Individual plugin logs with `source: 'plugin'`
- Legacy system logs with `source: 'discord'`

## 🚀 Next Steps

### Immediate (Ready Now):
1. ✅ Test plugin system with existing ProfileLookupTool
2. ✅ Monitor plugin statistics via API
3. ✅ Add your first new tool using the template above

### Short Term:
1. Convert existing actions to plugins
2. Add new tools specific to your use case
3. Optimize plugin triggers and configurations

### Long Term:
1. Develop advanced plugins with complex behaviors
2. Create plugin categories and management UI
3. Consider community plugin sharing

## 🎯 Success Metrics

You'll know the integration is successful when:
- ✅ Plugin system status shows `"active": true`
- ✅ New tools can be added by only editing `PluginConfiguration.js`
- ✅ Existing functionality continues to work unchanged
- ✅ Plugin statistics are available via API
- ✅ Hot-reload works for development

## 💡 Tips

1. **Start Small**: Add one simple tool to test the system
2. **Use Templates**: Copy existing plugin structure for new plugins  
3. **Test Thoroughly**: Use the API endpoints to verify plugin behavior
4. **Monitor Logs**: Plugin system provides detailed logging
5. **Gradual Migration**: No rush to convert everything at once

The plugin system is now ready for production use! 🎉