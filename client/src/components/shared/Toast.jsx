import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ 
  type = 'info',
  title,
  message,
  duration = 5000,
  onClose,
  position = 'top-right'
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const types = {
    success: {
      bgColor: 'bg-green-600',
      textColor: 'text-white',
      icon: CheckCircle,
      iconColor: 'text-green-200'
    },
    error: {
      bgColor: 'bg-red-600',
      textColor: 'text-white',
      icon: XCircle,
      iconColor: 'text-red-200'
    },
    warning: {
      bgColor: 'bg-yellow-600',
      textColor: 'text-white',
      icon: AlertTriangle,
      iconColor: 'text-yellow-200'
    },
    info: {
      bgColor: 'bg-blue-600',
      textColor: 'text-white',
      icon: Info,
      iconColor: 'text-blue-200'
    }
  };

  const positions = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  };

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose && onClose();
    }, 300);
  };

  if (!isVisible) return null;

  const config = types[type];
  const Icon = config.icon;

  return (
    <div 
      className={`fixed ${positions[position]} z-50 transition-all duration-300 ${
        isExiting ? 'opacity-0 transform scale-75' : 'opacity-100 transform scale-100'
      }`}
    >
      <div className={`${config.bgColor} ${config.textColor} rounded-lg shadow-lg border border-opacity-20 border-white max-w-sm w-full`}>
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
            </div>
            
            <div className="ml-3 flex-1">
              {title && (
                <h4 className="text-sm font-semibold mb-1">{title}</h4>
              )}
              
              <p className="text-sm opacity-90">{message}</p>
            </div>
            
            <div className="flex-shrink-0 ml-4">
              <button
                onClick={handleClose}
                className="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Toast Provider Hook
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now();
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (message, title) => addToast({ type: 'success', message, title });
  const error = (message, title) => addToast({ type: 'error', message, title });
  const warning = (message, title) => addToast({ type: 'warning', message, title });
  const info = (message, title) => addToast({ type: 'info', message, title });

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
};

export default Toast;