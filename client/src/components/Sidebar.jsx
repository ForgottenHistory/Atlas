import { Card } from './shared';

const Sidebar = ({ tabs, activeTab, onTabChange, className = '' }) => {
  return (
    <div className={`xl:w-64 flex-shrink-0 ${className}`}>
      <Card padding="p-4">
        <nav className="space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 group ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                    : 'bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white hover:scale-102'
                  }`}
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${activeTab === tab.id
                      ? 'text-blue-200'
                      : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                />
                <span className="font-medium">{tab.label}</span>

                {/* Active indicator */}
                {activeTab === tab.id && (
                  <div className="ml-auto w-2 h-2 bg-blue-300 rounded-full"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Optional footer section */}
        <div className="mt-8 pt-4 border-t border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Atlas Bot Dashboard
            </p>
            <p className="text-xs text-gray-600 mt-1">
              v1.0.0
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Sidebar;