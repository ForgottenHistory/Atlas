const Badge = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '' 
}) => {
  const variants = {
    primary: 'bg-blue-100 text-blue-800 border-blue-200',
    secondary: 'bg-gray-100 text-gray-800 border-gray-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    // Dark theme variants
    'primary-dark': 'bg-blue-900 bg-opacity-50 text-blue-300 border-blue-700',
    'secondary-dark': 'bg-gray-700 text-gray-300 border-gray-600',
    'success-dark': 'bg-green-900 bg-opacity-50 text-green-300 border-green-700',
    'danger-dark': 'bg-red-900 bg-opacity-50 text-red-300 border-red-700',
    'warning-dark': 'bg-yellow-900 bg-opacity-50 text-yellow-300 border-yellow-700',
    'info-dark': 'bg-cyan-900 bg-opacity-50 text-cyan-300 border-cyan-700'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const baseClasses = 'inline-flex items-center font-medium rounded-full border';
  const variantClasses = variants[variant] || variants.primary;
  const sizeClasses = sizes[size];

  return (
    <span className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;