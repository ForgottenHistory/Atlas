// Drop-in replacement for the old Logger with better component tracking
const ComponentLogger = require('./ComponentLogger');

// Export the singleton instance - exact same API as before
module.exports = ComponentLogger;