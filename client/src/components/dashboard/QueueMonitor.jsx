import { useState, useEffect } from 'react';
import { Clock, Activity, AlertTriangle, CheckCircle, Zap, Wifi, WifiOff } from 'lucide-react';
import { Card, Badge } from '../shared';

function QueueMonitor({ socketService }) {
  const [queueStats, setQueueStats] = useState({
    global: { active: 0, limit: 1 },
    types: {}
  });
  const [queueHealth, setQueueHealth] = useState({
    healthy: true,
    totalQueued: 0,
    activeGlobal: 0,
    maxQueue: 10
  });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socketService) {
      return;
    }

    setIsConnected(socketService.isConnected());

    // Listen for connection status
    const unsubscribeConnection = socketService.on('connection', (status) => {
      setIsConnected(status.connected);
    });

    // Listen for initial bot status with queue data
    const unsubscribeBotStatus = socketService.on('botStatus', (data) => {
      
      if (data.queueStats) {
        setQueueStats(data.queueStats);
      }
      if (data.queueHealth) {
        setQueueHealth(data.queueHealth);
      }
      setLastUpdate(new Date());
    });

    // THIS IS THE KEY FIX - Listen for real-time queue updates
    const unsubscribeQueueUpdate = socketService.on('queueUpdate', (data) => {
      
      if (data.stats) {
        setQueueStats(data.stats);
      }
      if (data.health) {
        setQueueHealth(data.health);
      }
      setLastUpdate(new Date(data.timestamp));
    });

    // Listen for stats updates that include queue data
    const unsubscribeStatsUpdate = socketService.on('statsUpdate', (data) => {
      if (data.queueStats) {
        setQueueStats(data.queueStats);
        setLastUpdate(new Date());
      }
    });

    // Listen for queue stats response
    const unsubscribeQueueStats = socketService.on('queueStats', (data) => {
      if (data.stats) setQueueStats(data.stats);
      if (data.health) setQueueHealth(data.health);
      setLastUpdate(new Date(data.timestamp));
    });

    // Also listen for queueStatsUpdated (from config changes)
    const unsubscribeQueueStatsUpdated = socketService.on('queueStatsUpdated', (data) => {
      if (data.stats) setQueueStats(data.stats);
      if (data.health) setQueueHealth(data.health);
      setLastUpdate(new Date(data.timestamp));
    });

    // Request initial queue stats
    if (socketService.isConnected()) {
      socketService.sendToServer('getQueueStats');
    }

    return () => {
      unsubscribeConnection();
      unsubscribeBotStatus();
      unsubscribeQueueUpdate();
      unsubscribeStatsUpdate();
      unsubscribeQueueStats();
      unsubscribeQueueStatsUpdated();
    };
  }, [socketService]);

  // Test function to manually request queue stats
  const refreshQueueStats = () => {
    if (socketService && socketService.isConnected()) {
      socketService.sendToServer('getQueueStats');
    }
  };

  const getHealthStatus = () => {
    if (queueHealth.healthy) {
      return {
        icon: CheckCircle,
        color: 'text-green-400',
        bgColor: 'bg-green-900 bg-opacity-30 border-green-700',
        text: 'Healthy'
      };
    } else {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-900 bg-opacity-30 border-yellow-700',
        text: 'High Load'
      };
    }
  };

  const getTypeDisplayName = (type) => {
    const names = {
      'character_generation': 'Character Responses',
      'message_response': 'Message Responses',
      'custom_prompt': 'Custom Prompts'
    };
    return names[type] || type;
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  const formatTimestamp = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <Card.Header className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-blue-400" />
            <Card.Title>Queue Monitor</Card.Title>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-400" />
            )}
            <button 
              onClick={refreshQueueStats}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <HealthIcon className={`h-4 w-4 ${healthStatus.color}`} />
            <span className={`text-sm ${healthStatus.color}`}>
              {healthStatus.text}
            </span>
          </div>
        </div>
      </Card.Header>
      
      <Card.Content className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {/* Global Stats */}
          <div className={`rounded-lg border p-4 ${healthStatus.bgColor}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Global Queue Status</h4>
              <Badge 
                variant={queueHealth.healthy ? 'success-dark' : 'warning-dark'} 
                size="sm"
              >
                {queueStats.global.active}/{queueStats.global.limit} active
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Total Queued:</span>
                <span className="ml-2 font-medium text-white">
                  {queueHealth.totalQueued}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Active Globally:</span>
                <span className="ml-2 font-medium text-white">
                  {queueHealth.activeGlobal}
                </span>
              </div>
            </div>
          </div>

          {/* Request Type Breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium text-white border-b border-gray-600 pb-2">
              Request Types
            </h4>
            
            {Object.entries(queueStats.types).map(([type, stats]) => (
              <div key={type} className="bg-gray-700 bg-opacity-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white text-sm">
                    {getTypeDisplayName(type)}
                  </span>
                  <div className="flex gap-2">
                    <Badge 
                      variant={stats.active > 0 ? 'success-dark' : 'secondary-dark'} 
                      size="sm"
                    >
                      {stats.active} active
                    </Badge>
                    {stats.queued > 0 && (
                      <Badge variant="warning-dark" size="sm">
                        {stats.queued} queued
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
                  <div>
                    Limit: <span className="text-white">{stats.limit}</span>
                  </div>
                  <div>
                    Queued: <span className="text-white">{stats.queued}</span>
                  </div>
                  <div>
                    Active: <span className="text-white">{stats.active}</span>
                  </div>
                </div>
                
                {/* Visual progress bar */}
                <div className="mt-2">
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        stats.active >= stats.limit 
                          ? 'bg-red-500' 
                          : stats.active > 0 
                            ? 'bg-green-500' 
                            : 'bg-gray-500'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (stats.active / stats.limit) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {Object.keys(queueStats.types).length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No queue types initialized</p>
              </div>
            )}
          </div>

          {/* Last Update */}
          <div className="pt-3 border-t border-gray-600">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              <span>Last updated: {formatTimestamp(lastUpdate)}</span>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

export default QueueMonitor;