import { useState } from 'react';
import { Settings as SettingsIcon, Activity, Bot, Hash } from 'lucide-react';

// Import hooks
import { useSocket, useBotData } from './hooks/useSocket';

// Import components
import Dashboard from './components/Dashboard';
import Persona from './components/Persona';
import Settings from './components/Settings';
import Channels from './components/Channels';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

function App() {
 const [activeTab, setActiveTab] = useState('dashboard');
 
 // Socket connection management
 const { isConnected: socketConnected, connectionError, socketService } = useSocket();
 
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
   { id: 'channels', label: 'Channels', icon: Hash },
   { id: 'settings', label: 'Settings', icon: SettingsIcon },
 ];

 const renderActiveTab = () => {
   switch (activeTab) {
     case 'dashboard':
       return (
         <Dashboard 
           stats={botStatus || {}} 
           recentActivity={recentActivity || []} 
           socketService={socketService}
         />
       );
     case 'persona':
       return <Persona onUpdatePersona={updatePersona} />;
     case 'channels':
       return <Channels socketService={socketService} />;
     case 'settings':
       return <Settings onUpdateSettings={updateSettings} />;
     default:
       return (
         <Dashboard 
           stats={botStatus || {}} 
           recentActivity={recentActivity || []} 
           socketService={socketService}
         />
       );
   }
 };

 return (
   <div className="min-h-screen bg-gray-900 text-white">
     {/* Header */}
     <Header 
       socketConnected={socketConnected}
       connectionError={connectionError}
     />

     <div className="max-w-full mx-auto px-6 py-8">
       <div className="flex flex-col xl:flex-row gap-8">
         {/* Sidebar Navigation */}
         <Sidebar 
           tabs={tabs}
           activeTab={activeTab}
           onTabChange={setActiveTab}
         />

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