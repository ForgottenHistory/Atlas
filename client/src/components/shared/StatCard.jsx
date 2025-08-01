const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  iconColor = 'text-blue-400',
  trend,
  trendDirection,
  className = '' 
}) => {
  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      return val.toLocaleString();
    }
    return val;
  };

  const getTrendColor = () => {
    if (!trend || !trendDirection) return '';
    return trendDirection === 'up' ? 'text-green-400' : 'text-red-400';
  };

  const getTrendIcon = () => {
    if (!trend || !trendDirection) return null;
    return trendDirection === 'up' ? '↗' : '↘';
  };

  return (
    <div className={`bg-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-white">
              {formatValue(value)}
            </p>
            {trend && (
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {getTrendIcon()} {trend}
              </span>
            )}
          </div>
        </div>
        
        {Icon && (
          <div className="flex-shrink-0">
            <Icon className={`h-8 w-8 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;