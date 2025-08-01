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

// Import routes and storage
const { router: botRouter, getBotData, getRuntimeData, updateRuntimeData } = require('./src/routes/bot');
const personaRouter = require('./src/routes/persona');
const settingsRouter = require('./src/routes/settings');
const storage = require('./src/utils/storage');

// Initialize storage once at startup
const initializeApp = async () => {
  try {
    await storage.init();
    console.log('Application initialized successfully');
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
    timestamp: new Date().toISOString()
  });
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);
  
  try {
    // Get current data (storage already initialized)
    const botData = await getBotData();
    
    // Send initial bot status
    socket.emit('botStatus', {
      isConnected: botData.isConnected,
      activeUsers: botData.activeUsers,
      messagesToday: botData.messagesToday,
      uptime: botData.uptime,
      recentActivity: botData.recentActivity
    });
  } catch (error) {
    console.error('Error initializing socket connection:', error);
  }
  
  // Handle bot connection toggle
  socket.on('toggleBotConnection', async () => {
    try {
      const runtimeData = getRuntimeData();
      runtimeData.isConnected = !runtimeData.isConnected;
      updateRuntimeData({ isConnected: runtimeData.isConnected });
      
      console.log('Bot connection toggled:', runtimeData.isConnected);
      
      // Add activity log
      const activity = await storage.addActivity(
        `Bot ${runtimeData.isConnected ? 'connected' : 'disconnected'}`
      );
      
      // Broadcast to all clients
      const botData = await getBotData();
      io.emit('botStatus', {
        isConnected: botData.isConnected,
        activeUsers: botData.activeUsers,
        messagesToday: botData.messagesToday,
        uptime: botData.uptime,
        recentActivity: botData.recentActivity
      });
      
      io.emit('newActivity', activity);
    } catch (error) {
      console.error('Error toggling bot connection:', error);
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
  
  // Handle settings updates
  socket.on('updateSettings', async (settingsData) => {
    try {
      console.log('Settings updated via socket:', settingsData);
      
      let updated = [];
      const updates = {};
      
      if (settingsData.botToken !== undefined) {
        updates.botToken = settingsData.botToken.trim();
        updated.push('bot token');
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
  
  // Simulate real-time stats updates
  const statsInterval = setInterval(() => {
    const runtimeData = getRuntimeData();
    if (runtimeData.isConnected) {
      const updates = {
        messagesToday: runtimeData.messagesToday + Math.floor(Math.random() * 5),
        activeUsers: Math.max(0, runtimeData.activeUsers + Math.floor(Math.random() * 3) - 1)
      };
      
      updateRuntimeData(updates);
      
      io.emit('statsUpdate', {
        activeUsers: updates.activeUsers,
        messagesToday: updates.messagesToday
      });
    }
  }, 5000);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(statsInterval);
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