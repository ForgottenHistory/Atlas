import { useState } from 'react';
import { Bot, Settings as SettingsIcon, Activity, Power } from 'lucide-react';

// Import hooks
import { useSocket, useBotData } from './hooks/useSocket';

// Import components
import Dashboard from './components/Dashboard';
import Persona from './components/Persona';
import Settings from './components/Settings';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Socket connection management
  const { isConnected: socketConnected, connectionError } = useSocket();
  
  // Bot data management
  const { 
    botStatus, 
    recentActivity, 
    toggleBotConnection, 
    updatePersona, 
    updateSettings 
  } = useBotData();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'persona', label: 'Persona', icon: Bot },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard stats={botStatus} recentActivity={recentActivity} />;
      case 'persona':
        return <Persona onUpdatePersona={updatePersona} />;
      case 'settings':
        return <Settings onUpdateSettings={updateSettings} />;
      default:
        return <Dashboard stats={botStatus} recentActivity={recentActivity} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-full mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Bot className="h-8 w-8 text-blue-400" />
              <h1 className="text-xl font-bold">Atlas Bot Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  socketConnected && botStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm">
                  {socketConnected 
                    ? (botStatus.isConnected ? 'Connected' : 'Disconnected')
                    : 'Socket Offline'
                  }
                </span>
              </div>
              
              {/* Connection Error */}
              {connectionError && (
                <div className="text-xs text-red-400 max-w-32 truncate" title={connectionError}>
                  Error: {connectionError}
                </div>
              )}
              
              {/* Toggle Button */}
              <button
                onClick={toggleBotConnection}
                disabled={!socketConnected}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  !socketConnected
                    ? 'bg-gray-600 cursor-not-allowed'
                    : botStatus.isConnected 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <Power className="h-4 w-4" />
                <span>{botStatus.isConnected ? 'Disconnect' : 'Connect'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-6 py-8">
        <div className="flex flex-col xl:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="xl:w-64 flex-shrink-0">
            <div className="bg-gray-800 rounded-lg p-4">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-800 rounded-lg p-6">
              {renderActiveTab()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;