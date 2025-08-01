import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService';

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    // Connect to socket
    socketService.connect();

    // Listen for connection status changes
    const unsubscribeConnection = socketService.on('connection', (status) => {
      setIsConnected(status.connected);
      if (status.error) {
        setConnectionError(status.error);
      } else {
        setConnectionError(null);
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribeConnection();
      socketService.disconnect();
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
      setRecentActivity(data.recentActivity || []);
    });

    // Listen for real-time stats updates
    socketService.listenToServer('statsUpdate', (data) => {
      setBotStatus(prev => ({
        ...prev,
        activeUsers: data.activeUsers,
        messagesToday: data.messagesToday
      }));
    });

    // Listen for new activity
    socketService.listenToServer('newActivity', (activity) => {
      setRecentActivity(prev => [activity, ...prev.slice(0, 9)]);
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