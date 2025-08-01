import { Bot, Power, ExternalLink } from 'lucide-react';
import { Button } from './shared';

const Header = ({ 
  socketConnected = false, 
  connectionError = null 
}) => {
  const handleInviteBot = () => {
    // Discord bot invite URL - replace CLIENT_ID with your bot's client ID
    const clientId = 'YOUR_BOT_CLIENT_ID';
    const permissions = '8'; // Administrator permissions, adjust as needed
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot`;
    
    window.open(inviteUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-full mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <Bot className="h-8 w-8 text-blue-400" />
            <h1 className="text-xl font-bold">Atlas Bot Dashboard</h1>
          </div>
          
          {/* Right Side Controls */}
          <div className="flex items-center space-x-4">
            {/* Invite Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleInviteBot}
              icon={<ExternalLink className="h-4 w-4" />}
            >
              Invite Bot
            </Button>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                socketConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm">
                {socketConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Connection Error */}
            {connectionError && (
              <div className="text-xs text-red-400 max-w-32 truncate" title={connectionError}>
                Error: {connectionError}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;