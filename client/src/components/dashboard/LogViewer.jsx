import { useState, useEffect, useRef } from 'react';
import { Terminal, Filter, Trash2, Download } from 'lucide-react';
import { Card, Button, Input, Dropdown } from '../shared';
import LogEntry from './LogEntry';

function LogViewer({ socketService }) {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [filters, setFilters] = useState({
    level: '',
    source: '',
    search: ''
  });
  const [autoScroll, setAutoScroll] = useState(false); // Disabled by default
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!socketService) {
      console.log('LogViewer: No socketService provided');
      return;
    }

    console.log('LogViewer: Setting up socket listeners');

    // Check connection status
    setIsConnected(socketService.isConnected());

    // Listen for new logs from server
    const unsubscribeNewLog = socketService.on('newLog', (logEntry) => {
      console.log('LogViewer: Received new log:', logEntry);
      setLogs(prev => [logEntry, ...prev.slice(0, 99)]);
    });

    // Listen for logs cleared
    const unsubscribeLogsCleared = socketService.on('logsCleared', () => {
      console.log('LogViewer: Logs cleared signal received');
      setLogs([]);
    });

    // Listen for initial logs data
    const unsubscribeLogsData = socketService.on('logsData', (data) => {
      console.log('LogViewer: Received logs data:', data);
      setLogs(data.logs || []);
    });

    // Listen for connection status changes
    const unsubscribeConnection = socketService.on('connection', (status) => {
      console.log('LogViewer: Socket connection status changed:', status);
      setIsConnected(status.connected);
      
      // Request logs when connected
      if (status.connected) {
        requestInitialLogs();
      }
    });

    // Request initial logs if already connected
    if (socketService.isConnected()) {
      requestInitialLogs();
    }

    function requestInitialLogs() {
      console.log('LogViewer: Requesting initial logs');
      try {
        socketService.sendToServer('getLogs', { limit: 50 });
      } catch (error) {
        console.error('LogViewer: Error requesting logs:', error);
      }
    }

    // Cleanup
    return () => {
      unsubscribeNewLog();
      unsubscribeLogsCleared();
      unsubscribeLogsData();
      unsubscribeConnection();
    };
  }, [socketService]);

  useEffect(() => {
    // Apply filters
    let filtered = [...logs];

    if (filters.level) {
      filtered = filtered.filter(log => log.level === filters.level);
    }

    if (filters.source) {
      filtered = filtered.filter(log => log.source === filters.source);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(search) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(search)
      );
    }

    setFilteredLogs(filtered);
    console.log('LogViewer: Filtered logs updated:', filtered.length, 'out of', logs.length);
  }, [logs, filters]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive (only if enabled)
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearLogs = () => {
    console.log('LogViewer: Clearing logs');
    if (socketService && socketService.isConnected()) {
      socketService.sendToServer('clearLogs');
    }
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = filteredLogs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const details = Object.keys(log.details || {}).length > 0 
        ? ` | Details: ${JSON.stringify(log.details)}` 
        : '';
      return `[${timestamp}] ${log.level.toUpperCase()}: ${log.message}${details}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const levelOptions = [
    { value: '', label: 'All Levels' },
    { value: 'error', label: 'Error' },
    { value: 'warn', label: 'Warning' },
    { value: 'info', label: 'Info' },
    { value: 'success', label: 'Success' },
    { value: 'debug', label: 'Debug' }
  ];

  const sourceOptions = [
    { value: '', label: 'All Sources' },
    { value: 'discord', label: 'Discord' },
    { value: 'llm', label: 'LLM' },
    { value: 'api', label: 'API' },
    { value: 'system', label: 'System' }
  ];

  return (
    <Card className="h-full flex flex-col">
      <Card.Header className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Terminal className="h-5 w-5 flex-shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <Card.Title className="whitespace-nowrap">System Logs</Card.Title>
              <span className="text-sm text-gray-400 whitespace-nowrap">
                ({filteredLogs.length} entries)
              </span>
            </div>
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                 title={isConnected ? 'Connected' : 'Disconnected'} />
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`${autoScroll 
                ? 'bg-green-600 bg-opacity-20 border-green-500 text-green-400' 
                : 'bg-red-600 bg-opacity-20 border-red-500 text-red-400'
              }`}
            >
              Auto-scroll {autoScroll ? 'ON' : 'OFF'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              icon={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
            
            <Button
              variant="danger"
              size="sm"
              onClick={clearLogs}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card.Header>
      
      <Card.Content className="flex-1 flex flex-col min-h-0">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 flex-shrink-0">
          <Input
            placeholder="Search logs..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            icon={<Filter className="h-4 w-4" />}
          />
          
          <Dropdown
            value={filters.level}
            onChange={(value) => handleFilterChange('level', value)}
            options={levelOptions}
            placeholder="Filter by level..."
          />
          
          <Dropdown
            value={filters.source}
            onChange={(value) => handleFilterChange('source', value)}
            options={sourceOptions}
            placeholder="Filter by source..."
          />
        </div>

        {/* Logs Display - Flexible height to match Recent Activity */}
        <div className="bg-gray-900 rounded-lg p-4 flex-1 overflow-y-auto font-mono text-sm min-h-0">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No logs available</p>
              <p className="text-xs mt-2">
                Socket: {isConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export default LogViewer;