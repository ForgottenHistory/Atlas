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

// Import routes
const { router: botRouter, botData } = require('./src/routes/bot');
const personaRouter = require('./src/routes/persona');
const settingsRouter = require('./src/routes/settings');

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
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial bot status
  socket.emit('botStatus', {
    isConnected: botData.isConnected,
    activeUsers: botData.activeUsers,
    messagesToday: botData.messagesToday,
    uptime: botData.uptime,
    recentActivity: botData.recentActivity
  });
  
  // Handle bot connection toggle
  socket.on('toggleBotConnection', () => {
    botData.isConnected = !botData.isConnected;
    console.log('Bot connection toggled:', botData.isConnected);
    
    // Add activity log
    const activity = {
      id: Date.now(),
      message: `Bot ${botData.isConnected ? 'connected' : 'disconnected'}`,
      timestamp: 'Just now'
    };
    botData.recentActivity.unshift(activity);
    botData.recentActivity = botData.recentActivity.slice(0, 10);
    
    // Broadcast to all clients
    io.emit('botStatus', {
      isConnected: botData.isConnected,
      activeUsers: botData.activeUsers,
      messagesToday: botData.messagesToday,
      uptime: botData.uptime,
      recentActivity: botData.recentActivity
    });
    
    io.emit('newActivity', activity);
  });
  
  // Handle persona updates
  socket.on('updatePersona', (personaData) => {
    console.log('Persona updated via socket:', personaData);
    
    if (personaData.name && personaData.description) {
      botData.persona = {
        name: personaData.name.trim(),
        description: personaData.description.trim()
      };
      
      const activity = {
        id: Date.now(),
        message: `Persona updated: ${personaData.name}`,
        timestamp: 'Just now'
      };
      botData.recentActivity.unshift(activity);
      botData.recentActivity = botData.recentActivity.slice(0, 10);
      
      socket.emit('personaUpdated', { success: true, data: botData.persona });
      io.emit('newActivity', activity);
    } else {
      socket.emit('personaUpdated', { success: false, error: 'Name and description required' });
    }
  });
  
  // Handle settings updates
  socket.on('updateSettings', (settingsData) => {
    console.log('Settings updated via socket:', settingsData);
    
    let updated = [];
    
    if (settingsData.botToken !== undefined) {
      botData.settings.botToken = settingsData.botToken.trim();
      updated.push('bot token');
    }
    
    if (settingsData.commandPrefix !== undefined) {
      if (settingsData.commandPrefix.trim()) {
        botData.settings.commandPrefix = settingsData.commandPrefix.trim();
        updated.push('command prefix');
      }
    }
    
    if (updated.length > 0) {
      const activity = {
        id: Date.now(),
        message: `Settings updated: ${updated.join(', ')}`,
        timestamp: 'Just now'
      };
      botData.recentActivity.unshift(activity);
      botData.recentActivity = botData.recentActivity.slice(0, 10);
      
      socket.emit('settingsUpdated', { success: true });
      io.emit('newActivity', activity);
    } else {
      socket.emit('settingsUpdated', { success: false, error: 'No valid settings provided' });
    }
  });
  
  // Simulate real-time stats updates
  const statsInterval = setInterval(() => {
    if (botData.isConnected) {
      botData.messagesToday += Math.floor(Math.random() * 5);
      botData.activeUsers += Math.floor(Math.random() * 3) - 1;
      
      // Keep activeUsers positive
      if (botData.activeUsers < 0) botData.activeUsers = 0;
      
      io.emit('statsUpdate', {
        activeUsers: botData.activeUsers,
        messagesToday: botData.messagesToday
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

server.listen(PORT, () => {
  console.log(`Atlas Bot API running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
});