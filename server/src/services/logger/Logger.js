class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100; // Keep last 100 logs in memory
    this.listeners = new Set();
  }

  log(level, message, details = {}) {
    const logEntry = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
      source: details.source || 'system'
    };

    // Add to logs array
    this.logs.unshift(logEntry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console output with formatting
    this.outputToConsole(logEntry);

    // Notify listeners (for real-time updates)
    this.notifyListeners(logEntry);

    return logEntry;
  }

  info(message, details = {}) {
    return this.log('info', message, details);
  }

  warn(message, details = {}) {
    return this.log('warn', message, details);
  }

  error(message, details = {}) {
    return this.log('error', message, details);
  }

  success(message, details = {}) {
    return this.log('success', message, details);
  }

  debug(message, details = {}) {
    if (process.env.NODE_ENV === 'development') {
      return this.log('debug', message, details);
    }
  }

  outputToConsole(logEntry) {
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] ${logEntry.level.toUpperCase()}:`;
    
    switch (logEntry.level) {
      case 'error':
        console.error(prefix, logEntry.message, logEntry.details);
        break;
      case 'warn':
        console.warn(prefix, logEntry.message, logEntry.details);
        break;
      case 'success':
        console.log(`\x1b[32m${prefix}\x1b[0m`, logEntry.message, logEntry.details);
        break;
      case 'debug':
        console.debug(`\x1b[36m${prefix}\x1b[0m`, logEntry.message, logEntry.details);
        break;
      default:
        console.log(prefix, logEntry.message, logEntry.details);
    }
  }

  // Get recent logs
  getRecentLogs(limit = 50) {
    return this.logs.slice(0, limit);
  }

  // Get logs by level
  getLogsByLevel(level, limit = 50) {
    return this.logs
      .filter(log => log.level === level)
      .slice(0, limit);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    this.notifyListeners({ type: 'clear' });
  }

  // Real-time updates
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(logEntry) {
    this.listeners.forEach(callback => {
      try {
        callback(logEntry);
      } catch (error) {
        console.error('Error in log listener:', error);
      }
    });
  }

  // Get logs filtered by criteria
  filterLogs(criteria = {}) {
    let filtered = [...this.logs];

    if (criteria.level) {
      filtered = filtered.filter(log => log.level === criteria.level);
    }

    if (criteria.source) {
      filtered = filtered.filter(log => log.source === criteria.source);
    }

    if (criteria.since) {
      const since = new Date(criteria.since);
      filtered = filtered.filter(log => new Date(log.timestamp) >= since);
    }

    if (criteria.search) {
      const search = criteria.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(search) ||
        JSON.stringify(log.details).toLowerCase().includes(search)
      );
    }

    return filtered.slice(0, criteria.limit || 50);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;