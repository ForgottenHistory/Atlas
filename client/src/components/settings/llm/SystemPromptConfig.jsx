import { Textarea } from '../../shared';

const SystemPromptConfig = ({ formData, onInputChange, isSubmitting }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  // Estimate token count for system prompt
  const estimateTokens = (text) => {
    return Math.ceil((text || '').length / 4);
  };

  const promptLength = (formData.systemPrompt || '').length;
  const estimatedTokens = estimateTokens(formData.systemPrompt);

  return (
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
        rows={8}
        disabled={isSubmitting}
        helperText={`Instructions that define how the AI should behave. ${promptLength} characters (≈${estimatedTokens} tokens)`}
      />
      
      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-200 mb-2">System Prompt Guidelines</h5>
        <div className="text-xs text-gray-400 space-y-1">
          <div>• Define the bot's personality and speaking style</div>
          <div>• Set response format guidelines (length, tone, etc.)</div>
          <div>• Specify any behavioral constraints or rules</div>
          <div>• Avoid conflicting instructions with persona description</div>
          <div>• Keep it concise but comprehensive</div>
        </div>
      </div>
    </div>
  );
};

export default SystemPromptConfig;