const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes, storage, and Discord bot
const { router: botRouter, getBotData, getRuntimeData, updateRuntimeData } = require('./src/routes/bot');
const personaRouter = require('./src/routes/persona');
const settingsRouter = require('./src/routes/settings');
const storage = require('./src/utils/storage');
const discordBot = require('./src/services/discordBot');

// Initialize storage and Discord bot
const initializeApp = async () => {
  try {
    await storage.init();
    console.log('Storage initialized successfully');

    // Initialize Discord bot
    const botStarted = await discordBot.initialize();
    if (botStarted) {
      console.log('Discord bot initialized successfully');
    } else {
      console.log('Discord bot initialization skipped (no token)');
    }
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
};

// API Routes
app.use('/api/bot', botRouter);
app.use('/api/persona', personaRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Atlas Bot API is running',
    timestamp: new Date().toISOString(),
    discordStatus: discordBot.getStatus()
  });
});

// Discord bot event handlers for socket.io
discordBot.on('botConnected', (data) => {
  console.log('Discord bot connected, notifying clients');
  updateRuntimeData({ isConnected: true });
  io.emit('botStatus', {
    ...getRuntimeData(),
    discordUser: data.username,
    guilds: data.guilds
  });
});

discordBot.on('botDisconnected', () => {
  console.log('Discord bot disconnected, notifying clients');
  updateRuntimeData({ isConnected: false });
  io.emit('botStatus', getRuntimeData());
});

discordBot.on('botError', (data) => {
  console.log('Discord bot error:', data.error);
  io.emit('botError', data);
});

discordBot.on('messageReceived', async (data) => {
  // Update message stats
  const runtimeData = getRuntimeData();
  updateRuntimeData({
    messagesToday: runtimeData.messagesToday + 1
  });

  // Notify clients
  io.emit('statsUpdate', {
    messagesToday: runtimeData.messagesToday + 1,
    activeUsers: runtimeData.activeUsers
  });

  // Add activity log
  await storage.addActivity(`Message from ${data.author} in ${data.guild}`);
  const activity = storage.getRecentActivity();
  io.emit('newActivity', activity[0]);
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  try {
    // Get current data
    const botData = await getBotData();
    const discordStatus = discordBot.getStatus();

    // Send initial bot status including Discord status
    socket.emit('botStatus', {
      isConnected: discordStatus.isConnected,
      activeUsers: botData.activeUsers,
      messagesToday: botData.messagesToday,
      uptime: botData.uptime,
      recentActivity: botData.recentActivity,
      discordUser: discordStatus.username,
      guilds: discordStatus.guilds
    });
  } catch (error) {
    console.error('Error initializing socket connection:', error);
  }

  // Handle bot connection toggle
  socket.on('toggleBotConnection', async () => {
    try {
      const discordStatus = discordBot.getStatus();

      if (discordStatus.isConnected) {
        // Disconnect bot
        await discordBot.disconnect();
        updateRuntimeData({ isConnected: false });
        await storage.addActivity('Bot manually disconnected');
      } else {
        // Connect bot
        const settings = storage.getSettings();
        if (!settings.botToken) {
          socket.emit('botError', { error: 'No bot token configured' });
          return;
        }

        const success = await discordBot.initialize();
        if (success) {
          updateRuntimeData({ isConnected: true });
          await storage.addActivity('Bot manually connected');
        } else {
          socket.emit('botError', { error: 'Failed to connect bot' });
          return;
        }
      }

      // Broadcast updated status
      const botData = await getBotData();
      const newDiscordStatus = discordBot.getStatus();

      io.emit('botStatus', {
        isConnected: newDiscordStatus.isConnected,
        activeUsers: botData.activeUsers,
        messagesToday: botData.messagesToday,
        uptime: botData.uptime,
        recentActivity: botData.recentActivity,
        discordUser: newDiscordStatus.username,
        guilds: newDiscordStatus.guilds
      });

    } catch (error) {
      console.error('Error toggling bot connection:', error);
      socket.emit('botError', { error: 'Failed to toggle bot connection' });
    }
  });

  // Handle persona updates
  socket.on('updatePersona', async (personaData) => {
    try {
      console.log('Persona updated via socket:', personaData);

      if (personaData.name && personaData.description) {
        const updates = {
          name: personaData.name.trim(),
          description: personaData.description.trim()
        };

        const success = await storage.updatePersona(updates);

        if (success) {
          const activity = await storage.addActivity(`Persona updated: ${personaData.name}`);

          socket.emit('personaUpdated', { success: true, data: storage.getPersona() });
          io.emit('newActivity', activity);
        } else {
          socket.emit('personaUpdated', { success: false, error: 'Failed to save persona' });
        }
      } else {
        socket.emit('personaUpdated', { success: false, error: 'Name and description required' });
      }
    } catch (error) {
      console.error('Error updating persona:', error);
      socket.emit('personaUpdated', { success: false, error: 'Server error' });
    }
  });

  // Handle settings updates (now with Discord bot restart)
  socket.on('updateSettings', async (settingsData) => {
    try {
      console.log('Settings updated via socket:', settingsData);

      let updated = [];
      const updates = {};
      let needsBotRestart = false;

      if (settingsData.botToken !== undefined) {
        updates.botToken = settingsData.botToken.trim();
        updated.push('bot token');
        needsBotRestart = true;
      }

      if (settingsData.commandPrefix !== undefined) {
        if (settingsData.commandPrefix.trim()) {
          updates.commandPrefix = settingsData.commandPrefix.trim();
          updated.push('command prefix');
        }
      }

      if (updated.length > 0) {
        const success = await storage.updateSettings(updates);

        if (success) {
          const activity = await storage.addActivity(`Settings updated: ${updated.join(', ')}`);

          // Restart Discord bot if token was updated
          if (needsBotRestart) {
            try {
              await discordBot.updateToken(updates.botToken);
              await storage.addActivity('Bot restarted with new token');
            } catch (error) {
              console.error('Failed to restart bot with new token:', error);
              await storage.addActivity('Bot restart failed with new token');
            }
          }

          socket.emit('settingsUpdated', { success: true });
          io.emit('newActivity', activity);
        } else {
          socket.emit('settingsUpdated', { success: false, error: 'Failed to save settings' });
        }
      } else {
        socket.emit('settingsUpdated', { success: false, error: 'No valid settings provided' });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      socket.emit('settingsUpdated', { success: false, error: 'Server error' });
    }
  });

  // Handle getting servers
  socket.on('getServers', () => {
    try {
      const servers = discordBot.getServers();
      socket.emit('serversData', { servers });
    } catch (error) {
      console.error('Error getting servers:', error);
      socket.emit('serversData', { servers: [], error: 'Failed to get servers' });
    }
  });

  socket.on('getBotStatus', async () => {
    try {
      const botData = await getBotData();
      const discordStatus = discordBot.getStatus();

      socket.emit('botStatus', {
        isConnected: discordStatus.isConnected,
        activeUsers: botData.activeUsers,
        messagesToday: botData.messagesToday,
        uptime: botData.uptime,
        recentActivity: botData.recentActivity,
        discordUser: discordStatus.username,
        guilds: discordStatus.guilds
      });
    } catch (error) {
      console.error('Error getting bot status:', error);
    }
  });

  // Handle getting channels for a server
  socket.on('getChannels', (data) => {
    try {
      const { serverId } = data;
      if (!serverId) {
        socket.emit('channelsData', { channels: [], error: 'Server ID required' });
        return;
      }

      const channels = discordBot.getChannels(serverId);
      const activeChannels = discordBot.getActiveChannels(serverId);

      socket.emit('channelsData', {
        channels,
        activeChannels,
        serverId
      });
    } catch (error) {
      console.error('Error getting channels:', error);
      socket.emit('channelsData', { channels: [], error: 'Failed to get channels' });
    }
  });

  // Handle updating active channels
  socket.on('updateActiveChannels', async (data) => {
    try {
      const { serverId, channelIds } = data;

      if (!serverId || !Array.isArray(channelIds)) {
        socket.emit('activeChannelsUpdated', {
          success: false,
          error: 'Invalid server ID or channel IDs'
        });
        return;
      }

      const success = await discordBot.updateActiveChannels(serverId, channelIds);

      socket.emit('activeChannelsUpdated', {
        success,
        serverId,
        channelIds: success ? channelIds : []
      });

    } catch (error) {
      console.error('Error updating active channels:', error);
      socket.emit('activeChannelsUpdated', {
        success: false,
        error: 'Failed to update active channels'
      });
    }
  });

  // Simulate real-time stats updates (only when bot is connected)
  const statsInterval = setInterval(() => {
    const discordStatus = discordBot.getStatus();
    if (discordStatus.isConnected) {
      const runtimeData = getRuntimeData();
      const updates = {
        activeUsers: Math.max(0, runtimeData.activeUsers + Math.floor(Math.random() * 3) - 1)
      };

      updateRuntimeData(updates);

      io.emit('statsUpdate', {
        activeUsers: updates.activeUsers,
        messagesToday: runtimeData.messagesToday
      });
    }
  }, 5000);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(statsInterval);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await discordBot.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

server.listen(PORT, async () => {
  console.log(`Atlas Bot API running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
  await initializeApp();
});