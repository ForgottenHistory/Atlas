import { useState, useEffect } from 'react';
import { Key, Hash, Save, RotateCcw } from 'lucide-react';
import { Button, Input, Alert, Card } from './shared';

function Settings({ onUpdateSettings }) {
  const [formData, setFormData] = useState({
    botToken: '',
    commandPrefix: '!'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [hasBotToken, setHasBotToken] = useState(false);

  useEffect(() => {
    // Load current settings
    const loadSettings = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/settings');
        const result = await response.json();
        
        if (result.success) {
          setFormData(prev => ({
            ...prev,
            commandPrefix: result.data.commandPrefix
          }));
          setHasBotToken(result.data.hasBotToken);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await onUpdateSettings(formData);

      if (result.success) {
        setMessage({ type: 'success', text: 'Settings updated successfully!' });
        setHasBotToken(true);
        // Clear bot token field for security
        setFormData(prev => ({ ...prev, botToken: '' }));
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update settings. Please try again.' });
      console.error('Settings update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:3001/api/settings/reset', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Settings reset successfully!' });
        setFormData({
          botToken: '',
          commandPrefix: '!'
        });
        setHasBotToken(false);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to reset settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
      console.error('Settings reset error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearMessage = () => setMessage({ type: '', text: '' });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      
      {message.text && (
        <Alert
          type={message.type}
          dismissible
          onDismiss={clearMessage}
          className="mb-6"
        >
          {message.text}
        </Alert>
      )}
      
      <Card>
        <Card.Header>
          <Card.Title>Bot Configuration</Card.Title>
          <p className="text-gray-400 text-sm mt-1">
            Configure your Discord bot settings and authentication
          </p>
        </Card.Header>
        
        <Card.Content>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              name="botToken"
              type="password"
              label={
                <div className="flex items-center gap-2">
                  Bot Token
                  {hasBotToken && (
                    <span className="text-green-400 text-xs bg-green-400 bg-opacity-20 px-2 py-1 rounded">
                      ✓ Configured
                    </span>
                  )}
                </div>
              }
              value={formData.botToken}
              onChange={handleInputChange}
              placeholder={hasBotToken ? "Enter new token to replace..." : "Enter bot token..."}
              icon={<Key className="h-4 w-4" />}
              helperText="Your bot token is stored securely and never displayed"
            />
            
            <Input
              name="commandPrefix"
              label="Command Prefix"
              value={formData.commandPrefix}
              onChange={handleInputChange}
              placeholder="!"
              icon={<Hash className="h-4 w-4" />}
              required
              helperText="Character that triggers bot commands (e.g. !help)"
            />
          </form>
        </Card.Content>
        
        <Card.Footer>
          <div className="flex gap-3">
            <Button 
              onClick={handleSubmit}
              loading={isSubmitting}
              icon={<Save className="h-4 w-4" />}
            >
              Save Settings
            </Button>
            
            <Button 
              variant="danger"
              onClick={handleReset}
              disabled={isSubmitting}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Reset to Defaults
            </Button>
          </div>
        </Card.Footer>
      </Card>
    </div>
  );
}

export default Settings;