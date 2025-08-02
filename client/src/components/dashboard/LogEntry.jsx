import { useState } from 'react';
import { ChevronRight, ChevronDown, AlertTriangle, Info, CheckCircle, XCircle, Bug, MessageSquare, Copy } from 'lucide-react';

function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const hasDetails = log.details && Object.keys(log.details).length > 0;
  const isPromptLog = log.message?.includes('AI prompt generated') && log.details?.fullPrompt;
  
  const getLevelConfig = (level) => {
    const configs = {
      error: {
        color: 'text-red-300',
        bg: 'bg-red-500 bg-opacity-10 border-red-500 border-opacity-20',
        badgeColor: 'bg-red-600 text-red-100',
        icon: XCircle
      },
      warn: {
        color: 'text-yellow-300',
        bg: 'bg-yellow-500 bg-opacity-10 border-yellow-500 border-opacity-20',
        badgeColor: 'bg-yellow-600 text-yellow-100',
        icon: AlertTriangle
      },
      info: {
        color: 'text-blue-300',
        bg: 'bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-20',
        badgeColor: 'bg-blue-600 text-blue-100',
        icon: Info
      },
      success: {
        color: 'text-green-300',
        bg: 'bg-green-500 bg-opacity-10 border-green-500 border-opacity-20',
        badgeColor: 'bg-green-600 text-green-100',
        icon: CheckCircle
      },
      debug: {
        color: 'text-purple-300',
        bg: 'bg-purple-500 bg-opacity-10 border-purple-500 border-opacity-20',
        badgeColor: 'bg-purple-600 text-purple-100',
        icon: Bug
      }
    };
    
    return configs[level] || configs.info;
  };
  
  const config = getLevelConfig(log.level);
  const Icon = isPromptLog ? MessageSquare : config.icon;
  
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleCopyPrompt = async () => {
    if (!log.details?.fullPrompt) return;
    
    try {
      await navigator.clipboard.writeText(log.details.fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  };

  const formatTokens = (tokens) => {
    if (!tokens) return '0';
    return tokens.toLocaleString();
  };
  
  const formatDetails = (details) => {
    if (!details || Object.keys(details).length === 0) return null;
    
    // Special handling for prompt logs
    if (isPromptLog) {
      return (
        <div className="space-y-4">
          {/* Token Usage Info */}
          {details.tokenUsage && (
            <div className="bg-gray-800 bg-opacity-80 rounded p-3">
              <h5 className="text-sm font-medium text-gray-200 mb-2">Token Usage</h5>
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-300">
                <div>Total: <span className="text-white">{formatTokens(details.tokenUsage.totalTokens)}</span></div>
                <div>Base: <span className="text-white">{formatTokens(details.tokenUsage.baseTokens)}</span></div>
                <div>History: <span className="text-white">{formatTokens(details.tokenUsage.historyTokens)}</span></div>
                <div>Messages: <span className="text-white">{details.tokenUsage.messagesIncluded || 0}</span></div>
              </div>
            </div>
          )}

          {/* Context Info */}
          <div className="bg-gray-800 bg-opacity-80 rounded p-3">
            <h5 className="text-sm font-medium text-gray-200 mb-2">Context</h5>
            <div className="text-xs text-gray-300 space-y-1">
              <div>Character: <span className="text-white">{details.character || 'Unknown'}</span></div>
              <div>Channel: <span className="text-white">{details.channel || 'Unknown'}</span></div>
              <div>Author: <span className="text-white">{details.author || 'Unknown'}</span></div>
            </div>
          </div>

          {/* Full Prompt */}
          {details.fullPrompt && (
            <div className="bg-gray-900 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-medium text-gray-200">Full Prompt</h5>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words">
                  {details.fullPrompt}
                </pre>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Regular details formatting
    return Object.entries(details).map(([key, value]) => {
      if (key === 'fullPrompt') return null; // Skip fullPrompt in regular view
      
      let displayValue = value;
      
      // Format different types nicely
      if (typeof value === 'object') {
        displayValue = JSON.stringify(value, null, 2);
      } else if (typeof value === 'boolean') {
        displayValue = value.toString();
      }
      
      return (
        <div key={key} className="ml-4 text-gray-300">
          <span className="text-gray-400">{key}:</span> {displayValue}
        </div>
      );
    }).filter(Boolean);
  };

  // Special styling for prompt logs
  const promptBg = isPromptLog 
    ? 'bg-cyan-600 bg-opacity-20 border-cyan-400 border-opacity-40' 
    : config.bg;
  const promptIconColor = isPromptLog ? 'text-cyan-300' : config.color;
  const hoverBg = isPromptLog 
    ? 'hover:bg-cyan-600 hover:bg-opacity-30' 
    : 'hover:bg-gray-800 hover:bg-opacity-50';

  return (
    <div className={`rounded border p-3 transition-colors ${hoverBg} ${promptBg}`}>
      {/* Main log entry with consistent grid layout */}
      <div 
        className={`grid grid-cols-[16px_16px_64px_60px_80px_1fr] gap-3 items-start ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Expand/Collapse Icon - Fixed width */}
        <div className="w-4 h-4 mt-0.5 flex justify-center">
          {hasDetails ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )
          ) : null}
        </div>
        
        {/* Level Icon - Fixed width */}
        <div className="w-4 h-4 mt-0.5 flex justify-center">
          <Icon className={`h-4 w-4 ${promptIconColor}`} />
        </div>
        
        {/* Timestamp - Fixed width */}
        <div className="text-gray-300 text-xs bg-gray-800 bg-opacity-60 py-0.5 rounded text-center">
          {formatTimestamp(log.timestamp)}
        </div>
        
        {/* Level Badge - Fixed width */}
        <div className={`text-xs px-2 py-0.5 rounded uppercase font-medium text-center ${config.badgeColor}`}>
          {isPromptLog ? 'PROMPT' : log.level}
        </div>
        
        {/* Source Badge - Fixed width */}
        <div className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200 text-center truncate">
          {log.source || 'system'}
        </div>
        
        {/* Message - Flexible width */}
        <div className="text-gray-100 break-words bg-gray-800 bg-opacity-40 px-3 py-1 rounded min-w-0">
          {log.message}
          {isPromptLog && log.details?.promptLength && (
            <span className="ml-2 text-xs text-purple-300">
              ({log.details.promptLength.toLocaleString()} chars)
            </span>
          )}
        </div>
      </div>
      
      {/* Expanded Details */}
      {expanded && hasDetails && (
        <div className="mt-3 pl-8 border-l-2 border-gray-600">
          <div className="text-xs text-gray-400 mb-2">
            {isPromptLog ? 'Prompt Details:' : 'Details:'}
          </div>
          <div className={isPromptLog ? '' : 'bg-gray-800 bg-opacity-80 rounded p-3 text-xs'}>
            {formatDetails(log.details)}
          </div>
        </div>
      )}
    </div>
  );
}

export default LogEntry;