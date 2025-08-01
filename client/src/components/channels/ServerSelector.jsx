import { Server } from 'lucide-react';
import { Button, Card, Dropdown } from '../shared';

function ServerSelector({ 
  servers, 
  selectedServer, 
  onServerChange, 
  onRefreshServers, 
  loading, 
  botConnected 
}) {
  return (
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
            onChange={onServerChange}
            placeholder="Select a server..."
            options={servers.map(server => ({
              value: server.id,
              label: `${server.name} (${server.memberCount} members)`
            }))}
            disabled={loading}
          />
          
          <div className="flex flex-col justify-end">
            <Button
              onClick={onRefreshServers}
              loading={loading}
              disabled={!botConnected}
              variant="outline"
              size="md"
            >
              Refresh Servers
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

export default ServerSelector;