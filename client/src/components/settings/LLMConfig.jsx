import { useState, useEffect } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import { Button, Card } from '../shared';
import ModelSelector from './llm/ModelSelector';
import TokenManagement from './llm/TokenManagement';
import SystemPromptConfig from './llm/SystemPromptConfig';
import ModelParameters from './llm/ModelParameters';

const LLMConfig = ({ onUpdateSettings, isSubmitting }) => {
  const [formData, setFormData] = useState({
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
    context_limit: '4096'
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
          context_limit: llmSettings.context_limit?.toString() || '4096'
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

  const handleSubmit = async () => {
    const llmSettings = {};
    
    // Handle string values
    if (formData.systemPrompt.trim() !== '') {
      llmSettings.systemPrompt = formData.systemPrompt.trim();
    }
    
    if (formData.model.trim() !== '') {
      llmSettings.model = formData.model.trim();
    }
    
    // Handle numeric parameters
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'systemPrompt' && key !== 'model' && value.trim() !== '') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          llmSettings[key] = numValue;
        }
      }
    });

    await onUpdateSettings({ llm: llmSettings });
  };

  const resetToDefaults = () => {
    setFormData({
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
      context_limit: '4096'
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
          {/* Model Selection */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              Model Selection
            </h4>
            
            <ModelSelector
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