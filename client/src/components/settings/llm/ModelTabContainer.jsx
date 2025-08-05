import { useState } from 'react';
import { Zap, MessageSquare, Eye } from 'lucide-react';
import ProviderConfig from './ProviderConfig';
import ModelSpecificConfig from './ModelSpecificConfig';

const ModelTabContainer = ({ formData, onInputChange, isSubmitting }) => {
  const [activeTab, setActiveTab] = useState('decision');

  const tabs = [
    {
      id: 'decision',
      label: 'Decision Making',
      icon: <Zap className="h-4 w-4" />,
      description: 'Fast model for quick decisions (respond/ignore/react)'
    },
    {
      id: 'conversation',
      label: 'Conversations',
      icon: <MessageSquare className="h-4 w-4" />,
      description: 'High-quality model for generating responses'
    },
    {
      id: 'image',
      label: 'Image Analysis',
      icon: <Eye className="h-4 w-4" />,
      description: 'Vision model for analyzing images and GIFs'
    }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            } disabled:opacity-50`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Description */}
      <div className="p-3 bg-gray-800 rounded-lg border border-gray-600">
        <p className="text-sm text-gray-300">
          {activeTabData?.description}
        </p>
      </div>

      {/* Provider Configuration */}
      <ProviderConfig
        type={activeTab}
        formData={formData}
        onInputChange={onInputChange}
        isSubmitting={isSubmitting}
      />

      {/* Model-Specific Configuration */}
      {formData[`${activeTab}_model`] && (
        <ModelSpecificConfig
          type={activeTab}
          formData={formData}
          onInputChange={onInputChange}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

export default ModelTabContainer;