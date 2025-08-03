import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, Zap, DollarSign, Clock } from 'lucide-react';
import { Input, Button, LoadingSpinner, Badge } from '../../shared';

const OpenRouterImageModelSelector = ({ 
  selectedModel, 
  onModelSelect, 
  disabled = false,
  apiKey = '' 
}) => {
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  
  const modelsPerPage = 6; // Fewer per page since we show more details

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
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredModels(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, models]);

  const fetchModels = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': apiKey ? `Bearer ${apiKey}` : undefined
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        // Filter for vision-capable models
        const visionModels = data.data.filter(model => 
          model.architecture?.input_modalities?.includes('image') ||
          model.name.toLowerCase().includes('vision') ||
          model.id.toLowerCase().includes('vision') ||
          model.description.toLowerCase().includes('vision') ||
          model.description.toLowerCase().includes('image')
        );
        
        setModels(visionModels);
        setFilteredModels(visionModels);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch OpenRouter models:', err);
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

  const formatPrice = (price) => {
    if (!price || price === "0") return "Free";
    const num = parseFloat(price);
    if (num < 0.000001) return "< $0.000001";
    return `$${num.toFixed(6)}`;
  };

  const formatContextLength = (length) => {
    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
    if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
    return length.toLocaleString();
  };

  return (
    <div className="space-y-2 relative">
      <label className="block text-sm font-medium text-gray-200">
        OpenRouter Vision Model
      </label>
      
      {/* Selected Model Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Eye className="h-4 w-4 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-white truncate">
                {selectedModelData ? selectedModelData.name : selectedModel || 'Select a vision model...'}
              </div>
              {selectedModelData && (
                <div className="text-xs text-gray-400 mt-1">
                  {formatContextLength(selectedModelData.context_length)} context • 
                  {formatPrice(selectedModelData.pricing?.prompt)}/token
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedModelData && (
              <Badge variant="primary-dark" size="sm">Vision</Badge>
            )}
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>
        </div>
      </button>

      {/* Model Selector Popup */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-96 overflow-hidden">
          <div className="p-4 flex flex-col max-h-96">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-200">Select Vision Model</span>
              <span className="text-xs text-gray-400">
                {models.length > 0 ? `${models.length} vision models` : 'Loading...'}
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

            {/* Results info */}
            {!loading && !error && filteredModels.length > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>
                  {filteredModels.length} result{filteredModels.length !== 1 ? 's' : ''}
                  {searchQuery && ` for "${searchQuery}"`}
                </span>
                {totalPages > 1 && (
                  <span>Page {currentPage} of {totalPages}</span>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <LoadingSpinner size="md" />
                <p className="text-gray-400 mt-2">Loading vision models...</p>
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
              <div className="flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto min-h-0">
                  {paginatedModels.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      No vision models found
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2"> {/* Add right padding for scrollbar */}
                      {paginatedModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => handleModelSelect(model)}
                          className={`w-full p-3 text-left rounded-lg border transition-colors ${
                            selectedModel === model.id
                              ? 'bg-purple-600 bg-opacity-20 border-purple-500 text-purple-300'
                              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-white text-sm truncate">
                                {model.name}
                              </div>
                              <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                {model.description}
                              </div>
                              
                              {/* Model specs */}
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <div className="flex items-center gap-1 text-blue-400">
                                  <Clock className="h-3 w-3" />
                                  {formatContextLength(model.context_length)}
                                </div>
                                <div className="flex items-center gap-1 text-green-400">
                                  <DollarSign className="h-3 w-3" />
                                  {formatPrice(model.pricing?.prompt)}
                                </div>
                                {model.architecture?.input_modalities?.includes('image') && (
                                  <Badge variant="primary-dark" size="sm">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Vision
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-600 flex-shrink-0">
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
            )}
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-400">
        Select a vision-capable model from OpenRouter for image analysis
      </p>
    </div>
  );
};

export default OpenRouterImageModelSelector;