import { useState } from 'react';
import { Zap, Bot, Eye, Key } from 'lucide-react';
import { Dropdown, Input } from '../../shared';
import ModelSelector from './ModelSelector';

const ProviderConfig = ({ 
  type, // 'decision', 'conversation', or 'image'
  formData, 
  onInputChange, 
  isSubmitting 
}) => {
  const getFieldName = (field) => `${type}_${field}`;
  const getValue = (field) => formData[getFieldName(field)] || '';

  const handleChange = (field, value) => {
    onInputChange(getFieldName(field), value);
  };

  const getProviderOptions = () => {
    if (type === 'image') {
      return [
        { value: '', label: 'Disabled' },
        { value: 'openrouter', label: 'OpenRouter' },
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'openai', label: 'OpenAI' }
      ];
    }
    return [
      { value: 'featherless', label: 'Featherless AI' },
      { value: 'openrouter', label: 'OpenRouter' }
    ];
  };

  const getProviderIcon = () => {
    switch (type) {
      case 'decision': return <Zap className="h-4 w-4" />;
      case 'conversation': return <Bot className="h-4 w-4" />;
      case 'image': return <Eye className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getProviderLabel = () => {
    switch (type) {
      case 'image': return 'Vision Provider';
      default: return 'LLM Provider';
    }
  };

  const getApiKeyLabel = () => {
    const provider = getValue('provider');
    switch (provider) {
      case 'openrouter': return 'OpenRouter API Key';
      case 'anthropic': return 'Anthropic API Key';
      case 'openai': return 'OpenAI API Key';
      case 'featherless': return 'Featherless API Key';
      default: return 'API Key';
    }
  };

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div className="flex items-center gap-3 mb-4">
        {getProviderIcon()}
        <h5 className="text-md font-medium text-gray-200 capitalize">
          {type} Model Configuration
        </h5>
      </div>

      <Dropdown
        label={getProviderLabel()}
        value={getValue('provider')}
        onChange={(value) => handleChange('provider', value)}
        options={getProviderOptions()}
        placeholder={`Select ${type === 'image' ? 'vision' : 'LLM'} provider...`}
        disabled={isSubmitting}
        helperText={`Provider for ${type} processing`}
      />

      {/* API Key */}
      {getValue('provider') && getValue('provider') !== '' && (
        <Input
          name={getFieldName('api_key')}
          type="password"
          label={getApiKeyLabel()}
          value={getValue('api_key')}
          onChange={(e) => handleChange('api_key', e.target.value)}
          placeholder={`Enter ${getValue('provider')} API key...`}
          disabled={isSubmitting}
          icon={<Key className="h-4 w-4" />}
          helperText="API key for the selected provider (stored securely)"
        />
      )}

      {/* Model Selection */}
      {getValue('provider') && (
        <ModelSelector
          provider={getValue('provider')}
          apiKey={getValue('api_key')}
          selectedModel={getValue('model')}
          onModelSelect={(modelId) => handleChange('model', modelId)}
          disabled={isSubmitting}
          isImageModel={type === 'image'}
        />
      )}
    </div>
  );
};

export default ProviderConfig;