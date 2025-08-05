import { useState, useEffect } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import { Button, Card } from '../shared';
import ModelTabContainer from './llm/ModelTabContainer';
import TokenManagement from './llm/TokenManagement';
import SystemPromptConfig from './llm/SystemPromptConfig';

const LLMConfig = ({ onUpdateSettings, isSubmitting }) => {
  const [formData, setFormData] = useState({
    // Legacy fallback settings
    max_characters: '2000',
    context_limit: '4096',
    systemPrompt: '',
    
    // Decision model settings
    decision_provider: 'featherless',
    decision_model: '',
    decision_api_key: '',
    decision_temperature: '0.3',
    decision_top_p: '1',
    decision_top_k: '',
    decision_max_tokens: '200',
    decision_frequency_penalty: '',
    decision_presence_penalty: '',
    decision_repetition_penalty: '1',
    decision_min_p: '',
    
    // Conversation model settings
    conversation_provider: 'featherless',
    conversation_model: '',
    conversation_api_key: '',
    conversation_temperature: '0.7',
    conversation_top_p: '1',
    conversation_top_k: '',
    conversation_max_tokens: '2000',
    conversation_frequency_penalty: '',
    conversation_presence_penalty: '',
    conversation_repetition_penalty: '1',
    conversation_min_p: '',
    
    // Image model settings
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
          // Legacy settings
          max_characters: llmSettings.max_characters?.toString() || '2000',
          context_limit: llmSettings.context_limit?.toString() || '4096',
          systemPrompt: llmSettings.systemPrompt || '',
          
          // Decision model settings
          decision_provider: llmSettings.decision_provider || 'featherless',
          decision_model: llmSettings.decision_model || '',
          decision_api_key: llmSettings.decision_api_key || '',
          decision_temperature: llmSettings.decision_temperature?.toString() || '0.3',
          decision_top_p: llmSettings.decision_top_p?.toString() || '1',
          decision_top_k: llmSettings.decision_top_k?.toString() || '',
          decision_max_tokens: llmSettings.decision_max_tokens?.toString() || '200',
          decision_frequency_penalty: llmSettings.decision_frequency_penalty?.toString() || '',
          decision_presence_penalty: llmSettings.decision_presence_penalty?.toString() || '',
          decision_repetition_penalty: llmSettings.decision_repetition_penalty?.toString() || '1',
          decision_min_p: llmSettings.decision_min_p?.toString() || '',
          
          // Conversation model settings
          conversation_provider: llmSettings.conversation_provider || 'featherless',
          conversation_model: llmSettings.conversation_model || '',
          conversation_api_key: llmSettings.conversation_api_key || '',
          conversation_temperature: llmSettings.conversation_temperature?.toString() || '0.7',
          conversation_top_p: llmSettings.conversation_top_p?.toString() || '1',
          conversation_top_k: llmSettings.conversation_top_k?.toString() || '',
          conversation_max_tokens: llmSettings.conversation_max_tokens?.toString() || '2000',
          conversation_frequency_penalty: llmSettings.conversation_frequency_penalty?.toString() || '',
          conversation_presence_penalty: llmSettings.conversation_presence_penalty?.toString() || '',
          conversation_repetition_penalty: llmSettings.conversation_repetition_penalty?.toString() || '1',
          conversation_min_p: llmSettings.conversation_min_p?.toString() || '',
          
          // Image model settings
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

  const handleSubmit = async () => {
    const llmSettings = {};
    
    // Handle string values
    const stringFields = [
      'systemPrompt',
      'decision_provider', 'decision_model', 'decision_api_key',
      'conversation_provider', 'conversation_model', 'conversation_api_key',
      'image_provider', 'image_model', 'image_api_key'
    ];
    
    stringFields.forEach(field => {
      if (formData[field] && formData[field].trim() !== '') {
        llmSettings[field] = formData[field].trim();
      }
    });
    
    // Handle numeric parameters
    const numericFields = [
      'max_characters', 'context_limit',
      'decision_temperature', 'decision_top_p', 'decision_top_k', 'decision_max_tokens',
      'decision_frequency_penalty', 'decision_presence_penalty', 'decision_repetition_penalty', 'decision_min_p',
      'conversation_temperature', 'conversation_top_p', 'conversation_top_k', 'conversation_max_tokens',
      'conversation_frequency_penalty', 'conversation_presence_penalty', 'conversation_repetition_penalty', 'conversation_min_p',
      'image_max_size', 'image_quality'
    ];
    
    numericFields.forEach(field => {
      if (formData[field] && formData[field].trim() !== '') {
        const numValue = parseFloat(formData[field]);
        if (!isNaN(numValue)) {
          llmSettings[field] = numValue;
        }
      }
    });

    await onUpdateSettings({ llm: llmSettings });
    
    // Scroll to top of page after saving
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetToDefaults = () => {
    setFormData({
      max_characters: '2000',
      context_limit: '4096',
      systemPrompt: '',
      
      decision_provider: 'featherless',
      decision_model: '',
      decision_api_key: '',
      decision_temperature: '0.3',
      decision_top_p: '1',
      decision_top_k: '',
      decision_max_tokens: '200',
      decision_frequency_penalty: '',
      decision_presence_penalty: '',
      decision_repetition_penalty: '1',
      decision_min_p: '',
      
      conversation_provider: 'featherless',
      conversation_model: '',
      conversation_api_key: '',
      conversation_temperature: '0.7',
      conversation_top_p: '1',
      conversation_top_k: '',
      conversation_max_tokens: '2000',
      conversation_frequency_penalty: '',
      conversation_presence_penalty: '',
      conversation_repetition_penalty: '1',
      conversation_min_p: '',
      
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
          Configure different models for specific tasks and memory management
        </p>
      </Card.Header>
      
      <Card.Content>
        <div className="space-y-8">
          {/* Multi-Model Configuration */}
          <Card>
            <Card.Header>
              <Card.Title>Multi-Model Setup</Card.Title>
              <p className="text-gray-400 text-sm mt-1">
                Use specialized models optimized for different tasks
              </p>
            </Card.Header>
            <Card.Content>
              <ModelTabContainer
                formData={formData}
                onInputChange={handleInputChange}
                isSubmitting={isSubmitting}
              />
            </Card.Content>
          </Card>

          {/* Global Settings */}
          <Card>
            <Card.Header>
              <Card.Title>Global Settings</Card.Title>
              <p className="text-gray-400 text-sm mt-1">
                Settings applied across all models
              </p>
            </Card.Header>
            <Card.Content>
              <div className="space-y-6">
                <TokenManagement
                  formData={formData}
                  onInputChange={handleInputChange}
                  isSubmitting={isSubmitting}
                />
                
                <SystemPromptConfig
                  formData={formData}
                  onInputChange={handleInputChange}
                  isSubmitting={isSubmitting}
                />
              </div>
            </Card.Content>
          </Card>
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