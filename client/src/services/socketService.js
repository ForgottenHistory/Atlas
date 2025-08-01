import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect(url = 'http://localhost:3001') {
    // Don't create new connection if already connected
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    // Clean up any existing socket first
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    console.log('Creating new socket connection...');
    this.socket = io(url, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
      forceNew: true // Force a new connection
    });

    this.setupEventListeners();
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
      this.connected = true;
      this.emit('connection', { connected: true, id: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.connected = false;
      this.emit('connection', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.emit('connection', { connected: false, error: error.message });
    });
  }

  // Event emission
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in listener for event ${event}:`, error);
      }
    });
  }

  // Event listening
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  // Socket.IO specific methods
  listenToServer(event, callback) {
    if (!this.socket) return;

    this.socket.on(event, (data) => {
      callback(data);
      // Also emit to internal listeners
      this.emit(event, data);
    });
  }

  sendToServer(event, data) {
    if (!this.socket || !this.connected) {
      console.warn(`Cannot send ${event}: socket not connected`);
      return Promise.reject(new Error('Socket not connected'));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      this.socket.emit(event, data);

      // Listen for response events
      const responseEvent = event.replace(/([A-Z])/g, '_$1').toLowerCase() + 'd';

      const handleResponse = (response) => {
        clearTimeout(timeout);
        this.socket.off(responseEvent, handleResponse);

        if (response && response.success !== undefined) {
          resolve(response);
        } else {
          resolve({ success: true }); // Default success for events without explicit response
        }
      };

      this.socket.once(responseEvent, handleResponse);
    });
  }

  // Bot-specific methods
  toggleBotConnection() {
    if (!this.socket || !this.connected) {
      return Promise.reject(new Error('Socket not connected'));
    }
    this.socket.emit('toggleBotConnection');
    return Promise.resolve({ success: true });
  }

  updatePersona(personaData) {
    if (!this.socket || !this.connected) {
      return Promise.reject(new Error('Socket not connected'));
    }

    return new Promise((resolve) => {
      const handleResponse = (response) => {
        this.socket.off('personaUpdated', handleResponse);
        resolve(response);
      };

      this.socket.once('personaUpdated', handleResponse);
      this.socket.emit('updatePersona', personaData);
    });
  }

  updateSettings(settingsData) {
    if (!this.socket || !this.connected) {
      return Promise.reject(new Error('Socket not connected'));
    }

    return new Promise((resolve) => {
      const handleResponse = (response) => {
        this.socket.off('settingsUpdated', handleResponse);
        resolve(response);
      };

      this.socket.once('settingsUpdated', handleResponse);
      this.socket.emit('updateSettings', settingsData);
    });
  }

  // Getters
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;