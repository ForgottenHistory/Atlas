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

    // Set up server event listeners that forward to internal listeners
    this.socket.on('newLog', (data) => {
      console.log('Socket received newLog:', data);
      this.emit('newLog', data);
    });

    this.socket.on('logsData', (data) => {
      console.log('Socket received logsData:', data);
      this.emit('logsData', data);
    });

    this.socket.on('logsCleared', () => {
      console.log('Socket received logsCleared');
      this.emit('logsCleared');
    });

    // Other existing events
    this.socket.on('botStatus', (data) => {
      this.emit('botStatus', data);
    });

    this.socket.on('statsUpdate', (data) => {
      this.emit('statsUpdate', data);
    });

    this.socket.on('newActivity', (data) => {
      this.emit('newActivity', data);
    });

    this.socket.on('personaUpdated', (data) => {
      this.emit('personaUpdated', data);
    });

    this.socket.on('settingsUpdated', (data) => {
      this.emit('settingsUpdated', data);
    });

    this.socket.on('serversData', (data) => {
      this.emit('serversData', data);
    });

    this.socket.on('channelsData', (data) => {
      this.emit('channelsData', data);
    });

    this.socket.on('activeChannelsUpdated', (data) => {
      this.emit('activeChannelsUpdated', data);
    });

    this.socket.on('botError', (data) => {
      this.emit('botError', data);
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
    console.log(`Setting up server listener for: ${event}`);
    
    if (!this.socket) {
      console.warn(`Cannot listen to ${event}: socket not initialized`);
      return;
    }

    // Use the internal event system instead of direct socket listening
    return this.on(event, callback);
  }

  sendToServer(event, data) {
    if (!this.socket || !this.connected) {
      console.warn(`Cannot send ${event}: socket not connected`);
      return Promise.reject(new Error('Socket not connected'));
    }

    console.log(`Sending to server: ${event}`, data);
    this.socket.emit(event, data);
    return Promise.resolve({ success: true });
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