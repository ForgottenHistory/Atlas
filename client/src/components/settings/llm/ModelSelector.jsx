import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Bot, ChevronDown } from 'lucide-react';
import { Input, Button, Card, LoadingSpinner } from '../../shared';

const ModelSelector = ({ 
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

  useEffect(() => {
    if (isOpen && models.length === 0) {
      fetchModels();
    }
  }, [isOpen]);

  useEffect(() => {
    // Filter models based on search query
    if (searchQuery.trim() === '') {
      setFilteredModels(models);
    } else {
      const filtered = models.filter(model =>
        model.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredModels(filtered);
    }
    setCurrentPage(1); // Reset to first page when searching
  }, [searchQuery, models]);

  const fetchModels = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:3001/api/settings/models');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data && Array.isArray(data.data)) {
        setModels(data.data);
        setFilteredModels(data.data);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
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
              {selectedModelData ? selectedModelData.id : selectedModel || 'Select a model...'}
            </div>
            {selectedModelData && (
              <div className="text-xs text-gray-400">
                {selectedModelData.context_length?.toLocaleString()} context • {selectedModelData.model_class}
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

            {/* Results count and pagination info */}
            {!loading && !error && filteredModels.length > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>
                  {filteredModels.length} result{filteredModels.length !== 1 ? 's' : ''}
                  {searchQuery && ` for "${searchQuery}"`}
                </span>
                {totalPages > 1 && (
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <LoadingSpinner size="md" />
                <p className="text-gray-400 mt-2">Loading models...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-4">
                <p className="text-red-400 text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchModels}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Models List */}
            {!loading && !error && (
              <>
                <div className="max-h-48 overflow-y-auto">
                  {paginatedModels.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      No models found
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {paginatedModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => handleModelSelect(model)}
                          className={`w-full p-3 text-left rounded-lg border transition-colors ${
                            selectedModel === model.id
                              ? 'bg-blue-600 bg-opacity-20 border-blue-500 text-blue-300'
                              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700'
                          }`}
                        >
                          <div className="font-medium text-white text-sm truncate">{model.id}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {model.context_length?.toLocaleString()} context • {model.model_class}
                          </div>
                        </button>
                      ))}
                    </div>
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
              </>
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