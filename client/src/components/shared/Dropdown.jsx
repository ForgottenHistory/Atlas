import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const Dropdown = ({ 
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  error,
  helperText,
  required = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(option => option.value === value);

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const baseClasses = 'w-full px-4 py-2 bg-gray-700 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  
  const borderClasses = error 
    ? 'border-red-500 focus:ring-red-500' 
    : 'border-gray-600';
  
  const buttonClasses = `${baseClasses} ${borderClasses} ${className}`;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className={`${buttonClasses} flex items-center justify-between`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className={selectedOption ? 'text-white' : 'text-gray-400'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown 
            className={`h-4 w-4 text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-4 py-2 text-gray-400 text-sm">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="w-full px-4 py-2 text-left hover:bg-gray-600 focus:bg-gray-600 focus:outline-none flex items-center justify-between transition-colors"
                  onClick={() => handleSelect(option)}
                >
                  <span className="text-white">{option.label}</span>
                  {value === option.value && (
                    <Check className="h-4 w-4 text-blue-400" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-xs text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

export default Dropdown;