import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Alert = ({ 
  type = 'info', 
  title, 
  children, 
  dismissible = false, 
  onDismiss,
  className = '' 
}) => {
  const types = {
    success: {
      bgColor: 'bg-green-600',
      textColor: 'text-white',
      icon: CheckCircle
    },
    error: {
      bgColor: 'bg-red-600',
      textColor: 'text-white',
      icon: XCircle
    },
    warning: {
      bgColor: 'bg-yellow-600',
      textColor: 'text-white',
      icon: AlertTriangle
    },
    info: {
      bgColor: 'bg-blue-600',
      textColor: 'text-white',
      icon: Info
    }
  };
  
  const config = types[type];
  const Icon = config.icon;
  
  return (
    <div className={`${config.bgColor} ${config.textColor} rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">{title}</h3>
          )}
          
          <div className="text-sm">
            {children}
          </div>
        </div>
        
        {dismissible && onDismiss && (
          <div className="flex-shrink-0 ml-4">
            <button
              onClick={onDismiss}
              className="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;