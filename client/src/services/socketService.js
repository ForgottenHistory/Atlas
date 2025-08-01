import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect(url = 'http://localhost:3001') {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(url, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
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
      this.socket.emit(event, data, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Bot-specific methods
  toggleBotConnection() {
    return this.sendToServer('toggleBotConnection');
  }

  updatePersona(personaData) {
    return this.sendToServer('updatePersona', personaData);
  }

  updateSettings(settingsData) {
    return this.sendToServer('updateSettings', settingsData);
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