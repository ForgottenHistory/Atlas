import { Input } from '../../shared';

const TokenManagement = ({ formData, onInputChange, isSubmitting }) => {
  const validateRange = (value, min, max) => {
    if (value === '') return true;
    const num = parseInt(value);
    return !isNaN(num) && num >= min && num <= max;
  };

  const getInputError = (field, value) => {
    switch (field) {
      case 'max_characters':
        const maxChars = parseInt(value);
        return value !== '' && (isNaN(maxChars) || maxChars < 50 || maxChars > 4000) 
          ? 'Must be between 50 and 4000 characters' : null;
      case 'context_limit':
        const contextLimit = parseInt(value);
        return value !== '' && (isNaN(contextLimit) || contextLimit < 512 || contextLimit > 1000000) 
          ? 'Must be between 512 and 1000000 tokens' : null;
      default:
        return null;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  // Estimate tokens from characters (rough approximation)
  const estimateTokensFromChars = (chars) => {
    return Math.ceil(chars / 4);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
        Memory & Output Management
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          name="max_characters"
          type="number"
          step="1"
          min="50"
          max="4000"
          label="Max Response Length"
          value={formData.max_characters}
          onChange={handleInputChange}
          placeholder="2000"
          disabled={isSubmitting}
          required
          error={getInputError('max_characters', formData.max_characters)}
          helperText={`Maximum characters for bot responses (≈${estimateTokensFromChars(parseInt(formData.max_characters) || 2000)} tokens)`}
        />
        
        <Input
          name="context_limit"
          type="number"
          step="1"
          min="512"
          max="1000000"
          label="Context Token Limit"
          value={formData.context_limit}
          onChange={handleInputChange}
          placeholder="4096"
          disabled={isSubmitting}
          required
          error={getInputError('context_limit', formData.context_limit)}
          helperText="Total token budget for entire prompt including history"
        />
      </div>
      
      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-200 mb-3">Dynamic Memory Management</h5>
        <div className="text-xs text-gray-400 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="font-medium text-gray-300 mb-1">Token Usage:</div>
              <div>• System prompt + persona</div>
              <div>• Conversation history (dynamic)</div>
              <div>• Response generation</div>
              <div>• 10% safety buffer</div>
            </div>
            <div>
              <div className="font-medium text-gray-300 mb-1">Memory Strategy:</div>
              <div>• Recent messages prioritized</div>
              <div>• Older messages dropped if needed</div>
              <div>• Character-based output limiting</div>
              <div>• Token-based context management</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenManagement;