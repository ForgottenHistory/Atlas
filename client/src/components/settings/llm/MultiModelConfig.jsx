import { useState } from 'react';
import { Brain, Zap, MessageSquare, Eye, Settings } from 'lucide-react';
import { Card, Dropdown } from '../../shared';
import ModelSelector from './ModelSelector';

const MultiModelConfig = ({ formData, onInputChange, isSubmitting }) => {
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

  const getModelFieldName = (type, field) => {
    if (type === 'decision') return `decision_${field}`;
    if (type === 'conversation') return `conversation_${field}`;
    if (type === 'image') return `image_${field}`;
    return field;
  };

  const getModelValue = (type, field) => {
    const fieldName = getModelFieldName(type, field);
    return formData[fieldName] || '';
  };

  const handleModelChange = (type, field, value) => {
    const fieldName = getModelFieldName(type, field);
    onInputChange(fieldName, value);
  };

  const renderModelConfig = (type) => {
    const isImageTab = type === 'image';
    
    return (
      <div className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            {isImageTab ? 'Vision Provider' : 'LLM Provider'}
          </label>
          <Dropdown
            value={getModelValue(type, 'provider')}
            onChange={(value) => handleModelChange(type, 'provider', value)}
            options={isImageTab ? [
              { value: 'openrouter', label: 'OpenRouter' },
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'openai', label: 'OpenAI' }
            ] : [
              { value: 'featherless', label: 'Featherless AI' },
              { value: 'openrouter', label: 'OpenRouter' }
            ]}
            placeholder={`Select ${isImageTab ? 'vision' : 'LLM'} provider...`}
            disabled={isSubmitting}
          />
        </div>

        {/* API Key */}
        {getModelValue(type, 'provider') && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
              API Key
            </label>
            <input
              type="password"
              value={getModelValue(type, 'api_key')}
              onChange={(e) => handleModelChange(type, 'api_key', e.target.value)}
              placeholder={`Enter ${getModelValue(type, 'provider')} API key...`}
              disabled={isSubmitting}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        )}

        {/* Model Selection */}
        {getModelValue(type, 'provider') && (
          <ModelSelector
            provider={getModelValue(type, 'provider')}
            apiKey={getModelValue(type, 'api_key')}
            selectedModel={getModelValue(type, 'model')}
            onModelSelect={(modelId) => handleModelChange(type, 'model', modelId)}
            disabled={isSubmitting}
            isImageModel={isImageTab}
          />
        )}

        {/* Model-specific parameters */}
        {!isImageTab && getModelValue(type, 'model') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
                Temperature
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={getModelValue(type, 'temperature')}
                onChange={(e) => handleModelChange(type, 'temperature', e.target.value)}
                placeholder={type === 'decision' ? '0.3' : '0.7'}
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <p className="text-xs text-gray-400">
                {type === 'decision' ? 'Lower for consistent decisions' : 'Higher for creative responses'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
                Max Tokens
              </label>
              <input
                type="number"
                min="50"
                max={type === 'decision' ? '500' : '4000'}
                value={getModelValue(type, 'max_tokens')}
                onChange={(e) => handleModelChange(type, 'max_tokens', e.target.value)}
                placeholder={type === 'decision' ? '200' : '2000'}
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <p className="text-xs text-gray-400">
                {type === 'decision' ? 'Short decisions only' : 'Full conversation responses'}
              </p>
            </div>
          </div>
        )}

        {/* Recommended Settings */}
        <div className="p-4 bg-blue-900 bg-opacity-30 rounded-lg border border-blue-600">
          <h4 className="text-sm font-medium text-blue-300 mb-2">💡 Recommended for {tabs.find(t => t.id === type)?.label}</h4>
          {type === 'decision' && (
            <div className="text-xs text-blue-200 space-y-1">
              <p>• <strong>Model:</strong> GLM-4-9B (fast, reliable decisions)</p>
              <p>• <strong>Temperature:</strong> 0.3 (consistent)</p>
              <p>• <strong>Max Tokens:</strong> 200 (quick responses)</p>
            </div>
          )}
          {type === 'conversation' && (
            <div className="text-xs text-blue-200 space-y-1">
              <p>• <strong>Model:</strong> Kimi-K2-Instruct (high quality)</p>
              <p>• <strong>Temperature:</strong> 0.7 (balanced creativity)</p>
              <p>• <strong>Max Tokens:</strong> 2000 (full responses)</p>
            </div>
          )}
          {type === 'image' && (
            <div className="text-xs text-blue-200 space-y-1">
              <p>• <strong>Provider:</strong> OpenRouter (best vision models)</p>
              <p>• <strong>Model:</strong> GPT-4 Vision or Claude-3 Vision</p>
              <p>• <strong>Quality:</strong> High for detailed analysis</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Multi-Model Configuration
        </Card.Title>
        <p className="text-gray-400 text-sm mt-1">
          Use different models optimized for specific tasks
        </p>
      </Card.Header>

      <Card.Content>
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-800 p-1 rounded-lg">
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
        <div className="mb-6 p-3 bg-gray-800 rounded-lg border border-gray-600">
          <p className="text-sm text-gray-300">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        {/* Active Tab Content */}
        {renderModelConfig(activeTab)}
      </Card.Content>
    </Card>
  );
};

export default MultiModelConfig;