import { Input } from '../../shared';

const ModelParameters = ({ formData, onInputChange, isSubmitting }) => {
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  const coreParameters = [
    {
      name: 'temperature',
      label: 'Temperature',
      placeholder: '0.6',
      required: true,
      step: '0.1',
      min: '0',
      max: '2',
      helpText: 'Controls randomness: 0 = deterministic, 2 = very random'
    },
    {
      name: 'top_p',
      label: 'Top P (Nucleus Sampling)',
      placeholder: '1',
      required: true,
      step: '0.01',
      min: '0.01',
      max: '1',
      helpText: 'Cumulative probability cutoff for token selection'
    }
  ];

  const advancedParameters = [
    {
      name: 'top_k',
      label: 'Top K',
      placeholder: 'Leave empty or -1 for all tokens',
      step: '1',
      helpText: 'Limits selection to top K tokens (-1 = no limit)'
    },
    {
      name: 'repetition_penalty',
      label: 'Repetition Penalty',
      placeholder: '1',
      required: true,
      step: '0.1',
      min: '0.1',
      max: '2',
      helpText: '>1 reduces repetition, <1 encourages it'
    },
    {
      name: 'frequency_penalty',
      label: 'Frequency Penalty',
      placeholder: 'Leave empty for default',
      step: '0.1',
      min: '-2',
      max: '2',
      helpText: 'Penalizes frequent tokens (OpenAI-style models)'
    },
    {
      name: 'presence_penalty',
      label: 'Presence Penalty',
      placeholder: 'Leave empty for default',
      step: '0.1',
      min: '-2',
      max: '2',
      helpText: 'Penalizes any token that appeared (OpenAI-style models)'
    },
    {
      name: 'min_p',
      label: 'Min P',
      placeholder: 'Leave empty or 0 to disable',
      step: '0.01',
      min: '0',
      max: '1',
      helpText: 'Minimum probability relative to most likely token'
    }
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
        Model Parameters
      </h4>
      
      {/* Core Parameters */}
      <div className="space-y-4">
        <h5 className="text-md font-medium text-gray-200">Core Parameters</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coreParameters.map((param) => (
            <Input
              key={param.name}
              name={param.name}
              type="number"
              step={param.step}
              min={param.min}
              max={param.max}
              label={param.label}
              value={formData[param.name]}
              onChange={handleInputChange}
              placeholder={param.placeholder}
              disabled={isSubmitting}
              required={param.required}
              error={getInputError(param.name, formData[param.name])}
              helperText={param.helpText}
            />
          ))}
        </div>
      </div>

      {/* Advanced Parameters */}
      <div className="space-y-4">
        <h5 className="text-md font-medium text-gray-200">Advanced Parameters</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {advancedParameters.map((param) => (
            <Input
              key={param.name}
              name={param.name}
              type="number"
              step={param.step}
              min={param.min}
              max={param.max}
              label={param.label}
              value={formData[param.name]}
              onChange={handleInputChange}
              placeholder={param.placeholder}
              disabled={isSubmitting}
              required={param.required}
              error={getInputError(param.name, formData[param.name])}
              helperText={param.helpText}
            />
          ))}
        </div>
      </div>

      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-200 mb-2">Parameter Tips</h5>
        <div className="text-xs text-gray-400 space-y-1">
          <div>• Start with temperature 0.6-0.8 for balanced responses</div>
          <div>• Use lower temperature (0.3-0.5) for more consistent character behavior</div>
          <div>• Repetition penalty 1.1-1.2 usually works well</div>
          <div>• Empty advanced parameters will use model defaults</div>
        </div>
      </div>
    </div>
  );
};

export default ModelParameters;