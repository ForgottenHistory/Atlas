import { forwardRef } from 'react';

const Textarea = forwardRef(({ 
  label, 
  error, 
  helperText, 
  className = '', 
  required = false,
  rows = 4,
  ...props 
}, ref) => {
  const baseClasses = 'w-full px-4 py-2 bg-gray-700 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-vertical';
  
  const borderClasses = error 
    ? 'border-red-500 focus:ring-red-500' 
    : 'border-gray-600';
  
  const classes = `${baseClasses} ${borderClasses} ${className}`;
  
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <textarea
        ref={ref}
        rows={rows}
        className={classes}
        {...props}
      />
      
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-xs text-gray-400">{helperText}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;