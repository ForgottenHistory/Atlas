import { Server } from 'lucide-react';
import { Button, Card } from '../shared';

function BotOfflineView() {
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

export default BotOfflineView;