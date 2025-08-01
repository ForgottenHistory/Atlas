const express = require('express');
const cors = require('cors');

// Import routes
const { router: botRouter } = require('./routes/bot');
const personaRouter = require('./routes/persona');
const settingsRouter = require('./routes/settings');

const createApp = () => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.use('/api/bot', botRouter);
  app.use('/api/persona', personaRouter);
  app.use('/api/settings', settingsRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    const discordService = require('./services/discord');
    
    res.json({
      success: true,
      message: 'Atlas Bot API is running',
      timestamp: new Date().toISOString(),
      discordStatus: discordService.getStatus()
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

  return app;
};

module.exports = createApp;