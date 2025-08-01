import { useState, useEffect } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import { Input, Button, Card, Textarea } from '../shared';
import ModelSelector from './ModelSelector';

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
    min_p: ''
  });

  useEffect(() => {
    // Load existing LLM settings
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
            min_p: llmSettings.min_p?.toString() || ''
          });
        }
      } catch (error) {
        console.error('Failed to load LLM settings:', error);
      }
    };

    loadLLMSettings();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Convert values to proper types and filter out empty values
    const llmSettings = {};
    
    // Handle system prompt and model (strings)
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
      min_p: ''
    });
  };

  const validateRange = (value, min, max, allowEmpty = true) => {
    if (allowEmpty && value === '') return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  };

  const getInputError = (field, value) => {
    switch (field) {
      case 'temperature':
        return !validateRange(value, 0, 2, false) ? 'Must be between 0 and 2' : null;
      case 'top_p':
        return !validateRange(value, 0.01, 1, false) ? 'Must be between 0.01 and 1' : null;
      case 'top_k':
        const topK = parseInt(value);
        return value !== '' && (isNaN(topK) || topK < -1) ? 'Must be -1 or positive integer' : null;
      case 'frequency_penalty':
        return !validateRange(value, -2, 2) ? 'Must be between -2 and 2' : null;
      case 'presence_penalty':
        return !validateRange(value, -2, 2) ? 'Must be between -2 and 2' : null;
      case 'repetition_penalty':
        return !validateRange(value, 0.1, 2, false) ? 'Must be between 0.1 and 2' : null;
      case 'min_p':
        return !validateRange(value, 0, 1) ? 'Must be between 0 and 1' : null;
      default:
        return null;
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          LLM Configuration
        </Card.Title>
        <p className="text-gray-400 text-sm mt-1">
          Configure language model parameters and system prompt
        </p>
      </Card.Header>
      
      <Card.Content>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Model Selection */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              Model Selection
            </h4>
            
            <ModelSelector
              selectedModel={formData.model}
              onModelSelect={(modelId) => setFormData(prev => ({ ...prev, model: modelId }))}
              disabled={isSubmitting}
            />
          </div>

          {/* System Prompt Section */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              System Instructions
            </h4>
            
            <Textarea
              name="systemPrompt"
              label="System Prompt"
              value={formData.systemPrompt}
              onChange={handleInputChange}
              placeholder="Define the bot's behavior, personality, and response guidelines..."
              rows={6}
              helperText="Instructions that define how the AI should behave and respond. This affects all bot interactions."
            />
          </div>

          {/* Model Parameters Section */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              Model Parameters
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                name="temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                label="Temperature"
                value={formData.temperature}
                onChange={handleInputChange}
                placeholder="0.6"
                required
                error={getInputError('temperature', formData.temperature)}
                helperText="Lower values = more deterministic, higher values = more random (0-2)"
              />
              
              <Input
                name="top_p"
                type="number"
                step="0.01"
                min="0.01"
                max="1"
                label="Top P"
                value={formData.top_p}
                onChange={handleInputChange}
                placeholder="1"
                required
                error={getInputError('top_p', formData.top_p)}
                helperText="Cumulative probability of top tokens (0.01-1)"
              />
              
              <Input
                name="top_k"
                type="number"
                step="1"
                label="Top K"
                value={formData.top_k}
                onChange={handleInputChange}
                placeholder="Leave empty or use -1 for all tokens"
                error={getInputError('top_k', formData.top_k)}
                helperText="Limits number of top tokens (-1 for all tokens)"
              />
              
              <Input
                name="frequency_penalty"
                type="number"
                step="0.1"
                min="-2"
                max="2"
                label="Frequency Penalty"
                value={formData.frequency_penalty}
                onChange={handleInputChange}
                placeholder="Leave empty for default"
                error={getInputError('frequency_penalty', formData.frequency_penalty)}
                helperText="Penalizes frequent tokens. Positive = new tokens, negative = repetition (-2 to 2)"
              />
              
              <Input
                name="presence_penalty"
                type="number"
                step="0.1"
                min="-2"
                max="2"
                label="Presence Penalty"
                value={formData.presence_penalty}
                onChange={handleInputChange}
                placeholder="Leave empty for default"
                error={getInputError('presence_penalty', formData.presence_penalty)}
                helperText="Penalizes present tokens. Positive = new tokens, negative = repetition (-2 to 2)"
              />
              
              <Input
                name="repetition_penalty"
                type="number"
                step="0.1"
                min="0.1"
                max="2"
                label="Repetition Penalty"
                value={formData.repetition_penalty}
                onChange={handleInputChange}
                placeholder="1"
                required
                error={getInputError('repetition_penalty', formData.repetition_penalty)}
                helperText="Penalizes repetition. >1 = new tokens, <1 = repetition (0.1-2)"
              />
              
              <Input
                name="min_p"
                type="number"
                step="0.01"
                min="0"
                max="1"
                label="Min P"
                value={formData.min_p}
                onChange={handleInputChange}
                placeholder="Leave empty or use 0 to disable"
                error={getInputError('min_p', formData.min_p)}
                helperText="Minimum probability relative to most likely token (0-1)"
              />
            </div>
          </div>
        </form>
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