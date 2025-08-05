import { useState, useEffect } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import { Button, Card } from '../shared';
import LLMProviderSelector from './llm/LLMProviderSelector';
import ModelSelector from './llm/ModelSelector';
import TokenManagement from './llm/TokenManagement';
import SystemPromptConfig from './llm/SystemPromptConfig';
import ModelParameters from './llm/ModelParameters';
import ImageReadingConfig from './llm/ImageReadingConfig';

const LLMConfig = ({ onUpdateSettings, isSubmitting }) => {
  const [formData, setFormData] = useState({
    provider: 'featherless', // Default to featherless
    model: '',
    systemPrompt: '',
    temperature: '0.6',
    top_p: '1',
    top_k: '',
    frequency_penalty: '',
    presence_penalty: '',
    repetition_penalty: '1',
    min_p: '',
    max_characters: '2000',
    context_limit: '4096',
    api_key: '', // Add API key field for OpenRouter
    // Image reading settings
    image_provider: '',
    image_model: '',
    image_api_key: '',
    image_max_size: '5',
    image_quality: '2'
  });

  useEffect(() => {
    loadLLMSettings();
  }, []);

  const loadLLMSettings = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/settings');
      const result = await response.json();

      if (result.success && result.data.llm) {
        const llmSettings = result.data.llm;
        setFormData({
          provider: llmSettings.provider || 'featherless',
          model: llmSettings.model || '',
          systemPrompt: llmSettings.systemPrompt || '',
          temperature: llmSettings.temperature?.toString() || '0.6',
          top_p: llmSettings.top_p?.toString() || '1',
          top_k: llmSettings.top_k?.toString() || '',
          frequency_penalty: llmSettings.frequency_penalty?.toString() || '',
          presence_penalty: llmSettings.presence_penalty?.toString() || '',
          repetition_penalty: llmSettings.repetition_penalty?.toString() || '1',
          min_p: llmSettings.min_p?.toString() || '',
          max_characters: llmSettings.max_characters?.toString() || '2000',
          context_limit: llmSettings.context_limit?.toString() || '4096',
          api_key: llmSettings.api_key || '',
          // Image reading settings
          image_provider: llmSettings.image_provider || '',
          image_model: llmSettings.image_model || '',
          image_api_key: llmSettings.image_api_key || '',
          image_max_size: llmSettings.image_max_size?.toString() || '5',
          image_quality: llmSettings.image_quality?.toString() || '2'
        });
      }
    } catch (error) {
      console.error('Failed to load LLM settings:', error);
    }
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProviderChange = (provider) => {
    // Reset model when provider changes
    setFormData(prev => ({
      ...prev,
      provider: provider,
      model: '' // Clear model selection when provider changes
    }));
  };

  const handleSubmit = async () => {
    const llmSettings = {};

    // Handle string values
    if (formData.systemPrompt.trim() !== '') {
      llmSettings.systemPrompt = formData.systemPrompt.trim();
    }

    if (formData.model.trim() !== '') {
      llmSettings.model = formData.model.trim();
    }

    if (formData.provider.trim() !== '') {
      llmSettings.provider = formData.provider.trim();
    }

    if (formData.api_key.trim() !== '') {
      llmSettings.api_key = formData.api_key.trim();
    }

    // Handle numeric parameters
    Object.entries(formData).forEach(([key, value]) => {
      if (!['systemPrompt', 'model', 'provider', 'api_key', 'image_provider', 'image_model', 'image_api_key'].includes(key) && value.trim() !== '') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          llmSettings[key] = numValue;
        }
      }
    });

    // Handle image reading string settings
    if (formData.image_provider && formData.image_provider.trim() !== '') {
      llmSettings.image_provider = formData.image_provider.trim();
    }

    if (formData.image_model && formData.image_model.trim() !== '') {
      llmSettings.image_model = formData.image_model.trim();
    }

    if (formData.image_api_key && formData.image_api_key.trim() !== '') {
      llmSettings.image_api_key = formData.image_api_key.trim();
    }

    await onUpdateSettings({ llm: llmSettings });
  };

  const resetToDefaults = () => {
    setFormData({
      provider: 'featherless',
      model: '',
      systemPrompt: '',
      temperature: '0.6',
      top_p: '1',
      top_k: '',
      frequency_penalty: '',
      presence_penalty: '',
      repetition_penalty: '1',
      min_p: '',
      max_characters: '2000',
      context_limit: '4096',
      api_key: '',
      // Reset image settings
      image_provider: '',
      image_model: '',
      image_api_key: '',
      image_max_size: '5',
      image_quality: '2'
    });
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          LLM Configuration
        </Card.Title>
        <p className="text-gray-400 text-sm mt-1">
          Configure language model parameters and memory management
        </p>
      </Card.Header>

      <Card.Content>
        <div className="space-y-8">
          {/* Provider & Model Selection */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              Provider & Model Selection
            </h4>

            <LLMProviderSelector
              selectedProvider={formData.provider}
              onProviderSelect={handleProviderChange}
              disabled={isSubmitting}
            />

            {/* API Key field for OpenRouter and Featherless */}
            {(formData.provider === 'openrouter' || formData.provider === 'featherless') && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-200">
                  {formData.provider === 'openrouter' ? 'OpenRouter API Key' : 'Featherless API Key'}
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => handleInputChange('api_key', e.target.value)}
                  placeholder={`Enter your ${formData.provider === 'openrouter' ? 'OpenRouter' : 'Featherless'} API key...`}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                />
                <p className="text-xs text-gray-400">
                  {formData.provider === 'openrouter'
                    ? <>Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">openrouter.ai</a></>
                    : <>Get your API key from <a href="https://featherless.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">featherless.ai</a></>
                  }
                </p>
              </div>
            )}

            <ModelSelector
              provider={formData.provider}
              apiKey={formData.api_key}
              selectedModel={formData.model}
              onModelSelect={(modelId) => handleInputChange('model', modelId)}
              disabled={isSubmitting}
            />
          </div>

          {/* Token & Memory Management */}
          <TokenManagement
            formData={formData}
            onInputChange={handleInputChange}
            isSubmitting={isSubmitting}
          />

          {/* System Prompt */}
          <SystemPromptConfig
            formData={formData}
            onInputChange={handleInputChange}
            isSubmitting={isSubmitting}
          />

          {/* Model Parameters */}
          <ModelParameters
            formData={formData}
            onInputChange={handleInputChange}
            isSubmitting={isSubmitting}
          />

          {/* Image Reading Configuration */}
          <ImageReadingConfig
            formData={formData}
            onInputChange={handleInputChange}
            isSubmitting={isSubmitting}
          />
        </div>
      </Card.Content>

      <Card.Footer>
        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            icon={<Brain className="h-4 w-4" />}
          >
            Save LLM Settings
          </Button>

          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={isSubmitting}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            Reset to Defaults
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
};

export default LLMConfig;