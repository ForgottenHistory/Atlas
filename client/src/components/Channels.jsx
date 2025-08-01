import { useState, useEffect } from 'react';
import { Hash, Server, Users, Volume2, Settings as SettingsIcon } from 'lucide-react';
import { Button, Card, Dropdown, Alert, Badge } from './shared';

function Channels({ socketService }) {
    const [servers, setServers] = useState([]);
    const [channels, setChannels] = useState([]);
    const [selectedServer, setSelectedServer] = useState('');
    const [selectedChannels, setSelectedChannels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [botStatus, setBotStatus] = useState({ isConnected: false });

    useEffect(() => {
        // Listen for bot status updates
        if (socketService) {
            socketService.listenToServer('botStatus', (data) => {
                setBotStatus(data);
                if (data.isConnected) {
                    loadServers();
                } else {
                    setServers([]);
                    setChannels([]);
                    setSelectedServer('');
                    setSelectedChannels([]);
                }
            });

            // Request current bot status when component loads
            if (socketService.isConnected()) {
                socketService.sendToServer('getBotStatus');
            }

            socketService.listenToServer('serversData', (data) => {
                setServers(data.servers || []);
                setLoading(false);
            });

            socketService.listenToServer('channelsData', (data) => {
                setChannels(data.channels || []);
                // Set previously active channels
                if (data.activeChannels) {
                    setSelectedChannels(data.activeChannels);
                }
                setLoading(false);
            });

            socketService.listenToServer('activeChannelsUpdated', (data) => {
                if (data.success) {
                    setMessage({ type: 'success', text: 'Active channels updated successfully!' });
                } else {
                    setMessage({ type: 'error', text: data.error || 'Failed to update channels' });
                }
                setLoading(false);
            });
        }
    }, [socketService]);

    const loadServers = async () => {
        if (!socketService || !socketService.isConnected()) return;

        setLoading(true);
        try {
            // Request servers data from backend
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
            // Request channels for selected server
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

    const getChannelIcon = (type) => {
        switch (type) {
            case 'GUILD_TEXT':
                return <Hash className="h-4 w-4" />;
            case 'GUILD_VOICE':
                return <Volume2 className="h-4 w-4" />;
            default:
                return <Hash className="h-4 w-4" />;
        }
    };

    const getChannelTypeBadge = (type) => {
        switch (type) {
            case 'GUILD_TEXT':
                return <Badge variant="info-dark" size="sm">Text</Badge>;
            case 'GUILD_VOICE':
                return <Badge variant="warning-dark" size="sm">Voice</Badge>;
            case 'GUILD_CATEGORY':
                return <Badge variant="secondary-dark" size="sm">Category</Badge>;
            default:
                return <Badge variant="secondary-dark" size="sm">{type}</Badge>;
        }
    };

    const clearMessage = () => setMessage({ type: '', text: '' });

    if (!botStatus.isConnected) {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-6">Channel Management</h2>

                <Card>
                    <Card.Content>
                        <div className="text-center py-12">
                            <Server className="h-16 w-16 mx-auto mb-4 text-gray-500" />
                            <h3 className="text-xl font-semibold text-gray-300 mb-2">Bot Not Connected</h3>
                            <p className="text-gray-400 mb-6">
                                Connect your Discord bot to manage server channels
                            </p>
                            <Button variant="outline" onClick={() => window.location.reload()}>
                                Refresh Status
                            </Button>
                        </div>
                    </Card.Content>
                </Card>
            </div>
        );
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

            {/* Server Selection */}
            <Card className="mb-6">
                <Card.Header>
                    <Card.Title className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Select Server
                    </Card.Title>
                    <p className="text-gray-400 text-sm mt-1">
                        Choose which Discord server to configure
                    </p>
                </Card.Header>

                <Card.Content>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Dropdown
                            label="Discord Server"
                            value={selectedServer}
                            onChange={handleServerChange}
                            placeholder="Select a server..."
                            options={servers.map(server => ({
                                value: server.id,
                                label: `${server.name} (${server.memberCount} members)`
                            }))}
                            disabled={loading}
                        />

                        <div className="flex flex-col justify-end">
                            <Button
                                onClick={loadServers}
                                loading={loading}
                                disabled={!botStatus.isConnected}
                                variant="outline"
                                size="md"
                            >
                                Refresh Servers
                            </Button>
                        </div>
                    </div>
                </Card.Content>
            </Card>

            {/* Channel Selection */}
            {selectedServer && (
                <Card>
                    <Card.Header>
                        <Card.Title className="flex items-center gap-2">
                            <Hash className="h-5 w-5" />
                            Active Channels
                        </Card.Title>
                        <p className="text-gray-400 text-sm mt-1">
                            Select channels where the bot should be active
                        </p>
                    </Card.Header>

                    <Card.Content>
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                                <p className="text-gray-400 mt-2">Loading channels...</p>
                            </div>
                        ) : channels.length === 0 ? (
                            <div className="text-center py-8">
                                <Hash className="h-12 w-12 mx-auto mb-3 text-gray-500" />
                                <p className="text-gray-400">No channels found in this server</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {channels.map((channel) => (
                                    <div
                                        key={channel.id}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${selectedChannels.includes(channel.id)
                                                ? 'bg-blue-600 bg-opacity-20 border-blue-500'
                                                : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                                            }`}
                                        onClick={() => toggleChannelSelection(channel.id)}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className={`${selectedChannels.includes(channel.id)
                                                    ? 'text-blue-400'
                                                    : 'text-gray-400'
                                                }`}>
                                                {getChannelIcon(channel.type)}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white">
                                                        {channel.type === 'GUILD_CATEGORY' ? channel.name : `#${channel.name}`}
                                                    </span>
                                                    {getChannelTypeBadge(channel.type)}
                                                </div>

                                                {channel.topic && (
                                                    <p className="text-sm text-gray-400 mt-1 line-clamp-1">
                                                        {channel.topic}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            {channel.memberCount && (
                                                <div className="flex items-center text-gray-400 text-sm">
                                                    <Users className="h-3 w-3 mr-1" />
                                                    {channel.memberCount}
                                                </div>
                                            )}

                                            <div className={`w-4 h-4 rounded border-2 ${selectedChannels.includes(channel.id)
                                                    ? 'bg-blue-500 border-blue-500'
                                                    : 'border-gray-400'
                                                }`}>
                                                {selectedChannels.includes(channel.id) && (
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card.Content>

                    {channels.length > 0 && (
                        <Card.Footer>
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-400">
                                    {selectedChannels.length} of {channels.filter(c => c.type !== 'GUILD_CATEGORY').length} channels selected
                                </div>

                                <Button
                                    onClick={handleSaveChannels}
                                    loading={loading}
                                    disabled={selectedChannels.length === 0}
                                    icon={<SettingsIcon className="h-4 w-4" />}
                                >
                                    Save Active Channels
                                </Button>
                            </div>
                        </Card.Footer>
                    )}
                </Card>
            )}
        </div>
    );
}

export default Channels;