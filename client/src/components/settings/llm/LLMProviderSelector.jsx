import { ChevronDown, Zap, Bot } from 'lucide-react';

const LLMProviderSelector = ({ 
  selectedProvider, 
  onProviderSelect, 
  disabled = false 
}) => {
  const providers = [
    {
      id: 'featherless',
      name: 'Featherless AI',
      description: 'High-performance LLM provider with competitive pricing',
      icon: <Zap className="h-4 w-4" />,
      features: ['Fast inference', 'Multiple models', 'Cost effective']
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      description: 'Access 400+ AI models through unified API',
      icon: <Bot className="h-4 w-4" />,
      features: ['400+ models', 'Unified API', 'Model comparison']
    }
  ];

  const selectedProviderData = providers.find(p => p.id === selectedProvider);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-200">
        LLM Provider
      </label>
      
      <div className="relative">
        <select
          value={selectedProvider}
          onChange={(e) => onProviderSelect(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-10"
        >
          <option value="">Select a provider...</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
        
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {selectedProviderData && (
        <div className="mt-2 p-3 bg-gray-800 rounded-lg border border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            {selectedProviderData.icon}
            <span className="text-sm font-medium text-white">{selectedProviderData.name}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{selectedProviderData.description}</p>
          <div className="flex flex-wrap gap-1">
            {selectedProviderData.features.map((feature, index) => (
              <span key={index} className="px-2 py-1 bg-blue-900 bg-opacity-50 text-blue-300 text-xs rounded">
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-400">
        Choose which LLM service provider to use for generating responses
      </p>
    </div>
  );
};

export default LLMProviderSelector;