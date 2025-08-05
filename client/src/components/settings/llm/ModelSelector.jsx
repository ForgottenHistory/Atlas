import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Bot, ChevronDown } from 'lucide-react';
import { Input, Button, Card, LoadingSpinner } from '../../shared';

const ModelSelector = ({ 
  provider = 'featherless',
  apiKey = '',
  selectedModel, 
  onModelSelect, 
  disabled = false 
}) => {
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  
  const modelsPerPage = 8;

  // Reset models when provider changes
  useEffect(() => {
    setModels([]);
    setFilteredModels([]);
    setError('');
    setCurrentPage(1);
  }, [provider]);

  useEffect(() => {
    if (isOpen && models.length === 0) {
      fetchModels();
    }
  }, [isOpen, provider]);

  useEffect(() => {
    // Filter models based on search query
    if (searchQuery.trim() === '') {
      setFilteredModels(models);
    } else {
      const filtered = models.filter(model => {
        const searchLower = searchQuery.toLowerCase();
        if (provider === 'openrouter') {
          return model.id.toLowerCase().includes(searchLower) ||
                 model.name.toLowerCase().includes(searchLower) ||
                 model.description.toLowerCase().includes(searchLower);
        } else {
          return model.id.toLowerCase().includes(searchLower);
        }
      });
      setFilteredModels(filtered);
    }
    setCurrentPage(1); // Reset to first page when searching
  }, [searchQuery, models, provider]);

  const fetchModels = async () => {
    setLoading(true);
    setError('');
    
    try {
      let response;
      
      if (provider === 'openrouter') {
        if (!apiKey) {
          throw new Error('OpenRouter API key required');
        }
        
        response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
      } else if (provider === 'featherless') {
        response = await fetch('http://localhost:3001/api/settings/models');
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      let modelList = [];
      
      if (provider === 'openrouter') {
        if (data.data && Array.isArray(data.data)) {
          modelList = data.data;
        } else {
          throw new Error('Invalid response format from OpenRouter API');
        }
      } else if (provider === 'featherless') {
        if (data.success && data.data && Array.isArray(data.data)) {
          modelList = data.data;
        } else {
          throw new Error(data.error || 'Invalid response format from Featherless API');
        }
      }
      
      setModels(modelList);
      setFilteredModels(modelList);
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setError(`Failed to load models: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredModels.length / modelsPerPage);
  const startIndex = (currentPage - 1) * modelsPerPage;
  const paginatedModels = filteredModels.slice(startIndex, startIndex + modelsPerPage);

  const handleModelSelect = (model) => {
    onModelSelect(model.id);
    setIsOpen(false);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  const getModelDisplayInfo = (model) => {
    if (provider === 'openrouter') {
      return {
        title: model.name || model.id,
        subtitle: `${model.context_length?.toLocaleString() || 'Unknown'} context • $${model.pricing?.prompt || '0'}/1M tokens`,
        description: model.description
      };
    } else {
      return {
        title: model.id,
        subtitle: `${model.context_length?.toLocaleString() || 'Unknown'} context • ${model.model_class || 'LLM'}`,
        description: null
      };
    }
  };

  // Don't show selector if provider not selected
  if (!provider) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-200">
          LLM Model
        </label>
        <div className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-gray-400 text-center">
          Select a provider first
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      <label className="block text-sm font-medium text-gray-200">
        LLM Model
      </label>
      
      {/* Selected Model Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Bot className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-white truncate">
              {selectedModelData ? getModelDisplayInfo(selectedModelData).title : selectedModel || 'Select a model...'}
            </div>
            {selectedModelData && (
              <div className="text-xs text-gray-400">
                {getModelDisplayInfo(selectedModelData).subtitle}
              </div>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Model Selector Popup */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-96">
          <div className="p-4">
            {/* Header with model count */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-200">Select Model</span>
              <span className="text-xs text-gray-400">
                {models.length > 0 ? `${models.length.toLocaleString()} available` : 'Loading...'}
              </span>
            </div>

            {/* Search */}
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              icon={<Search className="h-4 w-4" />}
              className="mb-4"
            />

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2 text-gray-400">Loading models...</span>
                </div>
              )}

              {error && (
                <div className="text-center py-8">
                  <p className="text-red-400 text-sm mb-2">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchModels}
                    disabled={loading}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {!loading && !error && filteredModels.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No models found</p>
                </div>
              )}

              {!loading && !error && filteredModels.length > 0 && (
                <>
                  {/* Results count and pagination info */}
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span>
                      {filteredModels.length} result{filteredModels.length !== 1 ? 's' : ''}
                    </span>
                    {totalPages > 1 && (
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                    )}
                  </div>

                  {/* Model List */}
                  <div className="space-y-2">
                    {paginatedModels.map((model) => {
                      const displayInfo = getModelDisplayInfo(model);
                      return (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(model)}
                          className={`w-full p-3 rounded-lg text-left transition-colors ${
                            selectedModel === model.id
                              ? 'bg-blue-600 bg-opacity-20 border-blue-500 text-blue-300'
                              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700'
                          }`}
                        >
                          <div className="font-medium text-white text-sm truncate">{displayInfo.title}</div>
                          <div className="text-xs text-gray-400 mt-1">{displayInfo.subtitle}</div>
                          {displayInfo.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{displayInfo.description}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-600">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  icon={<ChevronLeft className="h-4 w-4" />}
                >
                  Previous
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  icon={<ChevronRight className="h-4 w-4" />}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-400">
        Choose which AI model to use for generating responses
      </p>
    </div>
  );
};

export default ModelSelector;