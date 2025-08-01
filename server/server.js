const http = require('http');
require('dotenv').config();

const createApp = require('./src/app');
const SocketManager = require('./src/socket/socketManager');
const AppInitializer = require('./src/services/appInitializer');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Create Express app
    const app = createApp();
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.IO
    const socketManager = new SocketManager(server);
    
    // Initialize application services
    await AppInitializer.initialize();
    
    // Start server
    server.listen(PORT, () => {
      console.log(`Atlas Bot API running on port ${PORT}`);
      console.log(`Socket.IO server ready for connections`);
    });

    // Graceful shutdown handlers
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      
      await AppInitializer.shutdown();
      
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        console.log('Force closing server');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();