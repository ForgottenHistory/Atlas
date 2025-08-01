const Card = ({ 
  children, 
  className = '', 
  padding = 'p-6',
  hover = false 
}) => {
  const baseClasses = 'bg-gray-800 rounded-lg border border-gray-700';
  const hoverClasses = hover ? 'hover:bg-gray-750 transition-colors cursor-pointer' : '';
  
  return (
    <div className={`${baseClasses} ${hoverClasses} ${padding} ${className}`}>
      {children}
    </div>
  );
};

const CardHeader = ({ children, className = '' }) => (
  <div className={`pb-4 border-b border-gray-700 mb-4 ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-white ${className}`}>
    {children}
  </h3>
);

const CardContent = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
);

const CardFooter = ({ children, className = '' }) => (
  <div className={`pt-4 border-t border-gray-700 mt-4 ${className}`}>
    {children}
  </div>
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;