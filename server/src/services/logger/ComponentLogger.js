const path = require('path');

class ComponentLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 200;
    this.listeners = new Set();
  }

  // Auto-detect calling file/component
  _getCallerInfo() {
    const stack = (new Error()).stack;
    const lines = stack.split('\n');
    
    // Skip through all the logger wrapper functions to find the real caller
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip if it's in logger files
      if (line.includes('ComponentLogger.js') || line.includes('Logger.js')) {
        continue;
      }
      
      // Try to extract the file path
      const match = line.match(/at.*\((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/);
      if (match) {
        const fullPath = match[1];
        
        // Skip node_modules
        if (fullPath.includes('node_modules')) {
          continue;
        }
        
        const fileName = path.basename(fullPath, '.js');
        const directory = path.basename(path.dirname(fullPath));
        return `${directory}/${fileName}`;
      }
    }
    
    return 'unknown';
  }

  log(level, message, details = {}) {
    const component = this._getCallerInfo();
    
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level,
      message,
      component, // This is the key improvement
      details,
      // Keep legacy 'source' for backward compatibility
      source: details.source || component.split('/')[0]
    };

    this.logs.unshift(logEntry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.outputToConsole(logEntry);
    this.notifyListeners(logEntry);

    return logEntry;
  }

  outputToConsole(logEntry) {
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${logEntry.component}] ${logEntry.level.toUpperCase()}:`;
    
    switch (logEntry.level) {
      case 'error':
        console.error(`\x1b[31m${prefix}\x1b[0m`, logEntry.message, logEntry.details);
        break;
      case 'warn':
        console.warn(`\x1b[33m${prefix}\x1b[0m`, logEntry.message, logEntry.details);
        break;
      case 'success':
        console.log(`\x1b[32m${prefix}\x1b[0m`, logEntry.message, logEntry.details);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(`\x1b[36m${prefix}\x1b[0m`, logEntry.message, logEntry.details);
        }
        break;
      default:
        console.log(`\x1b[37m${prefix}\x1b[0m`, logEntry.message, logEntry.details);
    }
  }

  // Standard logging methods
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
    return this.log('debug', message, details);
  }

  // Enhanced filtering by component
  getLogsByComponent(component, limit = 50) {
    return this.logs
      .filter(log => log.component.includes(component))
      .slice(0, limit);
  }

  getRecentLogs(limit = 50) {
    return this.logs.slice(0, limit);
  }

  // Get all active components (for debugging what's actually running)
  getActiveComponents() {
    const components = new Set();
    this.logs.forEach(log => components.add(log.component));
    return Array.from(components).sort();
  }

  clearLogs() {
    this.logs = [];
    this.notifyListeners({ type: 'clear' });
  }

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

  filterLogs(criteria = {}) {
    let filtered = [...this.logs];

    if (criteria.level) {
      filtered = filtered.filter(log => log.level === criteria.level);
    }

    if (criteria.component) {
      filtered = filtered.filter(log => log.component.includes(criteria.component));
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
const logger = new ComponentLogger();

module.exports = logger;