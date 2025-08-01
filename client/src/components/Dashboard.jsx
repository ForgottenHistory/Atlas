import { MessageSquare, Users, Activity } from 'lucide-react';
import { StatCard, Card } from './shared';
import LogViewer from './dashboard/LogViewer';
import QueueMonitor from './dashboard/QueueMonitor';

function Dashboard({ stats, recentActivity, socketService }) {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Active Users"
          value={stats.activeUsers || 0}
          icon={Users}
          iconColor="text-blue-400"
        />
        
        <StatCard
          title="Messages Today"
          value={stats.messagesToday || 0}
          icon={MessageSquare}
          iconColor="text-green-400"
        />
        
        <StatCard
          title="Uptime"
          value={`${stats.uptime || 0}%`}
          icon={Activity}
          iconColor="text-purple-400"
        />
      </div>

      {/* Main Content Grid - Three columns on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 min-h-0">
        {/* Recent Activity */}
        <Card className="h-full flex flex-col">
          <Card.Header className="flex-shrink-0">
            <Card.Title>Recent Activity</Card.Title>
          </Card.Header>
          
          <Card.Content className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={activity.id ? `activity-${activity.id}` : `activity-index-${index}`} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{activity.message || 'Unknown activity'}</p>
                        <p className="text-gray-400 text-sm">{activity.timestamp || 'Unknown time'}</p>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-gray-700 rounded-lg p-8 text-center">
                  <div className="text-gray-400">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium">No recent activity</p>
                    <p className="text-sm">Activity will appear here when your bot is active</p>
                  </div>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>

        {/* Queue Monitor */}
        <QueueMonitor socketService={socketService} />

        {/* System Logs - Now includes prompts as special log entries */}
        <LogViewer socketService={socketService} />
      </div>
    </div>
  );
}

export default Dashboard;