import { useState, useEffect } from 'react';
import { Alert } from './shared';
import ServerSelector from './channels/ServerSelector';
import ChannelList from './channels/ChannelList';
import BotOfflineView from './channels/BotOfflineView';

function Channels({ socketService }) {
  const [servers, setServers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedServer, setSelectedServer] = useState('');
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [botStatus, setBotStatus] = useState({ isConnected: false });

  useEffect(() => {
    if (!socketService) return;

    // Listen for bot status updates
    socketService.listenToServer('botStatus', (data) => {
      setBotStatus(data);
      if (data.isConnected) {
        loadServers();
      } else {
        resetState();
      }
    });

    // Request current bot status when component loads
    if (socketService.isConnected()) {
      socketService.sendToServer('getBotStatus');
    }

    // Listen for servers data
    socketService.listenToServer('serversData', (data) => {
      setServers(data.servers || []);
      setLoading(false);
    });

    // Listen for channels data
    socketService.listenToServer('channelsData', (data) => {
      setChannels(data.channels || []);
      if (data.activeChannels) {
        setSelectedChannels(data.activeChannels);
      }
      setLoading(false);
    });

    // Listen for save response
    socketService.listenToServer('activeChannelsUpdated', (data) => {
      if (data.success) {
        setMessage({ type: 'success', text: 'Active channels updated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update channels' });
      }
      setLoading(false);
    });
  }, [socketService]);

  const resetState = () => {
    setServers([]);
    setChannels([]);
    setSelectedServer('');
    setSelectedChannels([]);
  };

  const loadServers = async () => {
    if (!socketService || !socketService.isConnected()) return;
    
    setLoading(true);
    try {
      socketService.sendToServer('getServers');
    } catch (error) {
      console.error('Failed to load servers:', error);
      setMessage({ type: 'error', text: 'Failed to load servers' });
      setLoading(false);
    }
  };

  const handleServerChange = async (serverId) => {
    setSelectedServer(serverId);
    setChannels([]);
    setSelectedChannels([]);
    
    if (!serverId || !socketService || !socketService.isConnected()) return;
    
    setLoading(true);
    try {
      socketService.sendToServer('getChannels', { serverId });
    } catch (error) {
      console.error('Failed to load channels:', error);
      setMessage({ type: 'error', text: 'Failed to load channels' });
      setLoading(false);
    }
  };

  const toggleChannelSelection = (channelId) => {
    setSelectedChannels(prev => {
      if (prev.includes(channelId)) {
        return prev.filter(id => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  const handleSaveChannels = async () => {
    if (!selectedServer || selectedChannels.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one channel' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      socketService.sendToServer('updateActiveChannels', {
        serverId: selectedServer,
        channelIds: selectedChannels
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update channels' });
      setLoading(false);
      console.error('Channel update error:', error);
    }
  };

  const clearMessage = () => setMessage({ type: '', text: '' });

  // Show offline view if bot is not connected
  if (!botStatus.isConnected) {
    return <BotOfflineView />;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Channel Management</h2>
      
      {message.text && (
        <Alert
          type={message.type}
          dismissible
          onDismiss={clearMessage}
          className="mb-6"
        >
          {message.text}
        </Alert>
      )}

      <ServerSelector
        servers={servers}
        selectedServer={selectedServer}
        onServerChange={handleServerChange}
        onRefreshServers={loadServers}
        loading={loading}
        botConnected={botStatus.isConnected}
      />

      {selectedServer && (
        <ChannelList
          channels={channels}
          selectedChannels={selectedChannels}
          onToggleChannel={toggleChannelSelection}
          onSaveChannels={handleSaveChannels}
          loading={loading}
        />
      )}
    </div>
  );
}

export default Channels;