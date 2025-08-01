import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService';

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    // Only connect if not already connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Listen for connection status changes
    const unsubscribeConnection = socketService.on('connection', (status) => {
      setIsConnected(status.connected);
      if (status.error) {
        setConnectionError(status.error);
      } else {
        setConnectionError(null);
      }
    });

    // Set initial connection state
    setIsConnected(socketService.isConnected());

    // Cleanup on unmount - only unsubscribe, don't disconnect
    return () => {
      unsubscribeConnection();
      // Don't disconnect here as other components might be using the socket
    };
  }, []);

  return {
    isConnected,
    connectionError,
    socketService
  };
};

export const useBotData = () => {
  const [botStatus, setBotStatus] = useState({
    isConnected: false,
    activeUsers: 0,
    messagesToday: 0,
    uptime: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    // Listen for bot status updates
    socketService.listenToServer('botStatus', (data) => {
      setBotStatus({
        isConnected: data.isConnected,
        activeUsers: data.activeUsers,
        messagesToday: data.messagesToday,
        uptime: data.uptime
      });
      if (data.recentActivity) {
        setRecentActivity(data.recentActivity);
      }
    });

    // Listen for real-time stats updates
    socketService.listenToServer('statsUpdate', (data) => {
      setBotStatus(prev => ({
        ...prev,
        activeUsers: data.activeUsers,
        messagesToday: data.messagesToday
      }));
    });

    // Listen for new activity - prevent duplicates
    socketService.listenToServer('newActivity', (activity) => {
      setRecentActivity(prev => {
        // Check if activity already exists
        const exists = prev.some(item => item.id === activity.id);
        if (exists) {
          return prev; // Don't add duplicate
        }
        return [activity, ...prev.slice(0, 9)]; // Keep only 10 items
      });
    });
  }, []);

  const toggleBotConnection = useCallback(async () => {
    try {
      await socketService.toggleBotConnection();
    } catch (error) {
      console.error('Failed to toggle bot connection:', error);
    }
  }, []);

  const updatePersona = useCallback(async (personaData) => {
    try {
      await socketService.updatePersona(personaData);
      return { success: true };
    } catch (error) {
      console.error('Failed to update persona:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const updateSettings = useCallback(async (settingsData) => {
    try {
      await socketService.updateSettings(settingsData);
      return { success: true };
    } catch (error) {
      console.error('Failed to update settings:', error);
      return { success: false, error: error.message };
    }
  }, []);

  return {
    botStatus,
    recentActivity,
    toggleBotConnection,
    updatePersona,
    updateSettings
  };
};