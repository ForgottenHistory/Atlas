const fs = require('fs').promises;
const path = require('path');

class Storage {
  constructor(filename = 'atlas-data.json') {
    this.filepath = path.join(process.cwd(), 'data', filename);
    this.data = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return; // Already initialized
    }

    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(path.dirname(this.filepath), { recursive: true });
      
      // Try to load existing data
      try {
        const content = await fs.readFile(this.filepath, 'utf8');
        this.data = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or is invalid, create default data
        this.data = this.getDefaultData();
        await this.save();
      }
      
      this.initialized = true;
      console.log('Storage initialized:', this.filepath);
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      this.data = this.getDefaultData();
      this.initialized = false;
    }
  }

  getDefaultData() {
    return {
      settings: {
        botToken: '',
        commandPrefix: '!'
      },
      persona: {
        name: '',
        description: ''
      },
      stats: {
        activeUsers: 1234,
        messagesToday: 5678,
        uptime: 99.9
      },
      recentActivity: [
        { id: 1, message: "Storage initialized", timestamp: "Just now" }
      ]
    };
  }

  async save() {
    if (!this.data) return false;
    
    try {
      await fs.writeFile(this.filepath, JSON.stringify(this.data, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save data:', error);
      return false;
    }
  }

  // Settings methods
  async updateSettings(newSettings) {
    if (!this.data) return false;
    
    this.data.settings = { ...this.data.settings, ...newSettings };
    return await this.save();
  }

  getSettings() {
    return this.data?.settings || this.getDefaultData().settings;
  }

  // Persona methods
  async updatePersona(newPersona) {
    if (!this.data) return false;
    
    this.data.persona = { ...this.data.persona, ...newPersona };
    return await this.save();
  }

  getPersona() {
    return this.data?.persona || this.getDefaultData().persona;
  }

  // Activity methods
  async addActivity(message) {
    if (!this.data) return false;
    
    const activity = {
      id: Date.now(),
      message,
      timestamp: 'Just now'
    };
    
    this.data.recentActivity.unshift(activity);
    this.data.recentActivity = this.data.recentActivity.slice(0, 10);
    
    await this.save();
    return activity;
  }

  getRecentActivity() {
    return this.data?.recentActivity || [];
  }

  // Stats methods
  updateStats(newStats) {
    if (!this.data) return false;
    
    this.data.stats = { ...this.data.stats, ...newStats };
    // Don't auto-save stats as they update frequently
  }

  getStats() {
    return this.data?.stats || this.getDefaultData().stats;
  }

  // General getter
  get(key) {
    return this.data?.[key];
  }

  // General setter
  async set(key, value) {
    if (!this.data) return false;
    
    this.data[key] = value;
    return await this.save();
  }
}

// Create singleton instance
const storage = new Storage();

module.exports = storage;