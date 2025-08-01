import { useState } from 'react';
import { Bot, Settings, MessageSquare, Users, Activity, Power } from 'lucide-react';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'persona', label: 'Persona', icon: Bot },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

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
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              
              <button
                onClick={() => setIsConnected(!isConnected)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isConnected 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <Power className="h-4 w-4" />
                <span>{isConnected ? 'Disconnect' : 'Connect'}</span>
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
              {activeTab === 'dashboard' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
                  
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div className="bg-gray-700 rounded-lg p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Active Users</p>
                          <p className="text-2xl font-bold">1,234</p>
                        </div>
                        <Users className="h-8 w-8 text-blue-400" />
                      </div>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Messages Today</p>
                          <p className="text-2xl font-bold">5,678</p>
                        </div>
                        <MessageSquare className="h-8 w-8 text-green-400" />
                      </div>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Uptime</p>
                          <p className="text-2xl font-bold">99.9%</p>
                        </div>
                        <Activity className="h-8 w-8 text-purple-400" />
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">User interaction in #general</p>
                              <p className="text-gray-400 text-sm">2 minutes ago</p>
                            </div>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'persona' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Bot Persona</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Character Name</label>
                      <input
                        type="text"
                        placeholder="Enter character name..."
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Personality Description</label>
                      <textarea
                        rows={4}
                        placeholder="Describe the bot's personality..."
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors">
                      Save Persona
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">User Management</h2>
                  <p className="text-gray-400">User management features coming soon...</p>
                </div>
              )}

              {activeTab === 'settings' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Settings</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Bot Token</label>
                      <input
                        type="password"
                        placeholder="Enter bot token..."
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Command Prefix</label>
                      <input
                        type="text"
                        placeholder="!"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors">
                      Save Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;