import { useState, useEffect } from 'react';
import { Eye, Copy, RefreshCw, MessageSquare } from 'lucide-react';
import { Card, Button, Modal, Badge } from '../shared';

function PromptViewer({ socketService }) {
  const [lastPrompt, setLastPrompt] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!socketService) return;

    // Listen for prompt data from the backend
    const unsubscribePromptData = socketService.on('promptGenerated', (data) => {
      setLastPrompt(data);
    });

    return () => {
      unsubscribePromptData();
    };
  }, [socketService]);

  const handleCopy = async () => {
    if (!lastPrompt?.prompt) return;
    
    try {
      await navigator.clipboard.writeText(lastPrompt.prompt);
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

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <Card.Header className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-purple-400" />
              <Card.Title>Last AI Prompt</Card.Title>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModal(true)}
              disabled={!lastPrompt}
              icon={<Eye className="h-4 w-4" />}
            >
              View Full
            </Button>
          </div>
        </Card.Header>
        
        <Card.Content className="flex-1 overflow-hidden">
          {lastPrompt ? (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Generated</p>
                  <p className="font-medium text-white">
                    {formatTimestamp(lastPrompt.timestamp)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Character</p>
                  <p className="font-medium text-white">
                    {lastPrompt.character || 'Unknown'}
                  </p>
                </div>
              </div>

              {/* Token Usage */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-200">Token Usage</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Badge variant="info-dark" size="sm">
                    Total: {formatTokens(lastPrompt.tokenUsage?.totalTokens)}
                  </Badge>
                  <Badge variant="secondary-dark" size="sm">
                    Base: {formatTokens(lastPrompt.tokenUsage?.baseTokens)}
                  </Badge>
                  <Badge variant="primary-dark" size="sm">
                    History: {formatTokens(lastPrompt.tokenUsage?.historyTokens)}
                  </Badge>
                  <Badge variant="warning-dark" size="sm">
                    {lastPrompt.tokenUsage?.messagesIncluded || 0} msgs
                  </Badge>
                </div>
              </div>

              {/* Prompt Preview */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-200">Prompt Preview</p>
                <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-300 max-h-32 overflow-y-auto">
                  {lastPrompt.prompt ? (
                    <div className="whitespace-pre-wrap break-words">
                      {lastPrompt.prompt.substring(0, 500)}
                      {lastPrompt.prompt.length > 500 && (
                        <span className="text-gray-500">
                          ... ({(lastPrompt.prompt.length - 500).toLocaleString()} more characters)
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">No prompt data available</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No Prompt Yet</p>
              <p className="text-sm text-center">
                Send a message to your bot to see the generated prompt
              </p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Full Prompt Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Full AI Prompt"
        size="xl"
      >
        <Modal.Body>
          {lastPrompt && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Character:</span>
                    <span className="ml-2 text-white font-medium">
                      {lastPrompt.character || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Tokens:</span>
                    <span className="ml-2 text-white font-medium">
                      {formatTokens(lastPrompt.tokenUsage?.totalTokens)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Messages:</span>
                    <span className="ml-2 text-white font-medium">
                      {lastPrompt.tokenUsage?.messagesIncluded || 0}
                    </span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  icon={<Copy className="h-4 w-4" />}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              {/* Full Prompt */}
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-words">
                  {lastPrompt.prompt || 'No prompt data available'}
                </pre>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default PromptViewer;