import { Eye, Image, Info } from 'lucide-react';
import { Input, Dropdown } from '../../shared';
import OpenRouterImageModelSelector from './OpenRouterImageModelSelector';

const ImageReadingConfig = ({ formData, onInputChange, isSubmitting }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  const handleDropdownChange = (name, value) => {
    onInputChange(name, value);
  };

  const imageProviderOptions = [
    { value: '', label: 'Disabled' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'anthropic', label: 'Anthropic Claude' },
    { value: 'openai', label: 'OpenAI GPT-4 Vision' }
  ];

  const imageModelOptions = {
    openrouter: [
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
      { value: 'openai/gpt-4-vision-preview', label: 'GPT-4 Vision' },
      { value: 'google/gemini-pro-vision', label: 'Gemini Pro Vision' }
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
    ],
    openai: [
      { value: 'gpt-4-vision-preview', label: 'GPT-4 Vision Preview' },
      { value: 'gpt-4o', label: 'GPT-4o' }
    ]
  };

  const currentModelOptions = imageModelOptions[formData.image_provider] || [];

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2 flex items-center gap-2">
        <Eye className="h-5 w-5" />
        Image Reading Capabilities
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Dropdown
          label="Image Provider"
          value={formData.image_provider || ''}
          onChange={(value) => handleDropdownChange('image_provider', value)}
          options={imageProviderOptions}
          placeholder="Select image provider..."
          disabled={isSubmitting}
          helperText="Provider for processing images in Discord messages"
        />

        {/* Dynamic Model Selection based on provider */}
        {formData.image_provider === 'openrouter' ? (
          <OpenRouterImageModelSelector
            selectedModel={formData.image_model || ''}
            onModelSelect={(modelId) => handleDropdownChange('image_model', modelId)}
            disabled={isSubmitting}
            apiKey={formData.image_api_key || ''}
          />
        ) : (
          <Dropdown
            label="Image Model"
            value={formData.image_model || ''}
            onChange={(value) => handleDropdownChange('image_model', value)}
            options={currentModelOptions}
            placeholder={formData.image_provider ? "Select image model..." : "Select provider first"}
            disabled={isSubmitting || !formData.image_provider}
            helperText="Specific model for image analysis"
          />
        )}
      </div>

      {/* API Key field - conditionally shown based on provider */}
      {formData.image_provider && formData.image_provider !== '' && (
        <div className="grid grid-cols-1 gap-4">
          <Input
            name="image_api_key"
            type="password"
            label={`${formData.image_provider === 'openrouter' ? 'OpenRouter' : 
                   formData.image_provider === 'anthropic' ? 'Anthropic' : 
                   'OpenAI'} API Key`}
            value={formData.image_api_key || ''}
            onChange={handleInputChange}
            placeholder="Enter API key for image provider..."
            disabled={isSubmitting}
            helperText="API key for the selected image provider (stored securely)"
          />
        </div>
      )}

      {/* Image Processing Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          name="image_max_size"
          type="number"
          step="0.1"
          min="0.5"
          max="20"
          label="Max Image Size (MB)"
          value={formData.image_max_size || '5'}
          onChange={handleInputChange}
          placeholder="5"
          disabled={isSubmitting}
          helperText="Maximum image file size to process"
        />

        <Input
          name="image_quality"
          type="range"
          min="1"
          max="3"
          step="1"
          label={`Image Quality: ${
            formData.image_quality === '1' ? 'Low (Fast)' :
            formData.image_quality === '2' ? 'Medium' :
            formData.image_quality === '3' ? 'High (Detailed)' :
            'Medium'
          }`}
          value={formData.image_quality || '2'}
          onChange={handleInputChange}
          disabled={isSubmitting}
          helperText="Processing quality vs speed tradeoff"
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-100">
            <p className="font-medium mb-2">Image Reading Features:</p>
            <ul className="text-xs space-y-1 text-blue-200">
              <li>• Analyze images shared in Discord channels</li>
              <li>• Describe image contents and answer questions</li>
              <li>• React contextually to memes, screenshots, and photos</li>
              <li>• OCR text reading from images</li>
              <li>• Requires separate API key from image provider</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageReadingConfig;