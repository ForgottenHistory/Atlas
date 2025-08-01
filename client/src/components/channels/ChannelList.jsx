import { Hash, Users, Settings as SettingsIcon } from 'lucide-react';
import { Button, Card, Badge } from '../shared';

function ChannelList({ 
  channels, 
  selectedChannels, 
  onToggleChannel, 
  onSaveChannels, 
  loading 
}) {
  const getChannelIcon = (type) => {
    switch (type) {
      case 'GUILD_TEXT':
        return <Hash className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getChannelTypeBadge = (type) => {
    switch (type) {
      case 'GUILD_TEXT':
        return <Badge variant="info-dark" size="sm">Text</Badge>;
      case 'GUILD_ANNOUNCEMENT':
        return <Badge variant="success-dark" size="sm">News</Badge>;
      case 'GUILD_FORUM':
        return <Badge variant="warning-dark" size="sm">Forum</Badge>;
      default:
        return <Badge variant="secondary-dark" size="sm">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <Card.Content>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-gray-400 mt-2">Loading channels...</p>
          </div>
        </Card.Content>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <Card.Content>
          <div className="text-center py-8">
            <Hash className="h-12 w-12 mx-auto mb-3 text-gray-500" />
            <p className="text-gray-400">No text channels found in this server</p>
          </div>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Active Channels
        </Card.Title>
        <p className="text-gray-400 text-sm mt-1">
          Select text channels where the bot should be active
        </p>
      </Card.Header>
      
      <Card.Content>
        <div className="space-y-2">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedChannels.includes(channel.id)
                  ? 'bg-blue-600 bg-opacity-20 border-blue-500'
                  : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => onToggleChannel(channel.id)}
            >
              <div className="flex items-center space-x-3">
                <div className={`${
                  selectedChannels.includes(channel.id) 
                    ? 'text-blue-400' 
                    : 'text-gray-400'
                }`}>
                  {getChannelIcon(channel.type)}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      #{channel.name}
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
                <div className={`w-4 h-4 rounded border-2 ${
                  selectedChannels.includes(channel.id)
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
      </Card.Content>
      
      <Card.Footer>
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {selectedChannels.length} of {channels.length} channels selected
          </div>
          
          <Button
            onClick={onSaveChannels}
            loading={loading}
            disabled={selectedChannels.length === 0}
            icon={<SettingsIcon className="h-4 w-4" />}
          >
            Save Active Channels
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}

export default ChannelList;