const { EventEmitter } = require('events');
const logger = require('../../logger/Logger');

/**
 * Event-driven communication bus for decoupling components
 * Replaces direct calls with publish/subscribe pattern
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
    this.eventStats = new Map();
    
    // Enable unlimited listeners for plugin system
    this.setMaxListeners(0);
    
    logger.info('EventBus initialized', { source: 'event_bus' });
  }

  /**
   * Emit an event with enhanced logging and tracking
   */
  emitEvent(eventName, data = {}) {
    try {
      const eventData = {
        name: eventName,
        data,
        timestamp: new Date(),
        id: this.generateEventId()
      };

      // Store in history
      this.addToHistory(eventData);
      
      // Update stats
      this.updateStats(eventName);

      // Log event emission
      logger.debug('Event emitted', {
        source: 'event_bus',
        eventName,
        eventId: eventData.id,
        hasData: Object.keys(data).length > 0
      });

      // Emit the event
      this.emit(eventName, eventData);
      
      return eventData.id;
    } catch (error) {
      logger.error('Failed to emit event', {
        source: 'event_bus',
        eventName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Subscribe to an event with enhanced error handling
   */
  subscribe(eventName, handler, context = null) {
    try {
      const wrappedHandler = (eventData) => {
        try {
          if (context) {
            handler.call(context, eventData);
          } else {
            handler(eventData);
          }
        } catch (error) {
          logger.error('Event handler error', {
            source: 'event_bus',
            eventName,
            eventId: eventData.id,
            error: error.message
          });
        }
      };

      this.on(eventName, wrappedHandler);
      
      logger.debug('Event subscription added', {
        source: 'event_bus',
        eventName,
        hasContext: !!context
      });

      // Return unsubscribe function
      return () => this.off(eventName, wrappedHandler);
    } catch (error) {
      logger.error('Failed to subscribe to event', {
        source: 'event_bus',
        eventName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Subscribe to an event only once
   */
  subscribeOnce(eventName, handler, context = null) {
    try {
      const wrappedHandler = (eventData) => {
        try {
          if (context) {
            handler.call(context, eventData);
          } else {
            handler(eventData);
          }
        } catch (error) {
          logger.error('One-time event handler error', {
            source: 'event_bus',
            eventName,
            eventId: eventData.id,
            error: error.message
          });
        }
      };

      this.once(eventName, wrappedHandler);
      
      logger.debug('One-time event subscription added', {
        source: 'event_bus',
        eventName
      });

    } catch (error) {
      logger.error('Failed to subscribe to event once', {
        source: 'event_bus',
        eventName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  getStats() {
    const stats = {
      totalEvents: this.eventHistory.length,
      uniqueEventTypes: this.eventStats.size,
      recentEvents: this.eventHistory.slice(-10),
      eventCounts: Object.fromEntries(this.eventStats),
      listeners: {}
    };

    // Count listeners per event
    for (const eventName of this.eventNames()) {
      stats.listeners[eventName] = this.listenerCount(eventName);
    }

    return stats;
  }

  /**
   * Get recent event history
   */
  getRecentEvents(limit = 50) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Clear event history (useful for memory management)
   */
  clearHistory() {
    const clearedCount = this.eventHistory.length;
    this.eventHistory = [];
    this.eventStats.clear();
    
    logger.info('Event history cleared', {
      source: 'event_bus',
      clearedEvents: clearedCount
    });
  }

  /**
   * Common event patterns for Atlas
   */
  
  // Message events
  messageReceived(message, context = {}) {
    return this.emitEvent('message:received', { message, ...context });
  }

  messageProcessed(message, decision, context = {}) {
    return this.emitEvent('message:processed', { message, decision, ...context });
  }

  // Action events
  actionStarted(actionType, context = {}) {
    return this.emitEvent('action:started', { actionType, ...context });
  }

  actionCompleted(actionType, result, context = {}) {
    return this.emitEvent('action:completed', { actionType, result, ...context });
  }

  actionFailed(actionType, error, context = {}) {
    return this.emitEvent('action:failed', { actionType, error: error.message, ...context });
  }

  // Tool events
  toolExecuted(toolName, result, context = {}) {
    return this.emitEvent('tool:executed', { toolName, result, ...context });
  }

  // Decision events
  decisionMade(decision, context = {}) {
    return this.emitEvent('decision:made', { decision, ...context });
  }

  // Plugin events
  pluginRegistered(pluginName, pluginType) {
    return this.emitEvent('plugin:registered', { pluginName, pluginType });
  }

  pluginExecuted(pluginName, result, context = {}) {
    return this.emitEvent('plugin:executed', { pluginName, result, ...context });
  }

  // System events
  systemError(error, context = {}) {
    return this.emitEvent('system:error', { error: error.message, ...context });
  }

  systemStatus(status, context = {}) {
    return this.emitEvent('system:status', { status, ...context });
  }

  // === PRIVATE METHODS ===

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addToHistory(eventData) {
    this.eventHistory.push(eventData);
    
    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  updateStats(eventName) {
    const currentCount = this.eventStats.get(eventName) || 0;
    this.eventStats.set(eventName, currentCount + 1);
  }
}

// Export singleton instance
module.exports = new EventBus();