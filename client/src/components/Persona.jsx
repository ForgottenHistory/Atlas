import { useState } from 'react';
import { User, FileText } from 'lucide-react';
import { Button, Input, Textarea, Alert, Card } from './shared';

function Persona({ onUpdatePersona }) {
  const [formData, setFormData] = useState({
    characterName: '',
    personalityDescription: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

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
      const result = await onUpdatePersona({
        name: formData.characterName,
        description: formData.personalityDescription
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Persona updated successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update persona' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update persona. Please try again.' });
      console.error('Persona update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearMessage = () => setMessage({ type: '', text: '' });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Bot Persona</h2>
      
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
          <Card.Title>Configure Your Bot's Personality</Card.Title>
          <p className="text-gray-400 text-sm mt-1">
            Define how your bot should behave and respond to users
          </p>
        </Card.Header>
        
        <Card.Content>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              name="characterName"
              label="Character Name"
              value={formData.characterName}
              onChange={handleInputChange}
              placeholder="Enter character name..."
              icon={<User className="h-4 w-4" />}
              required
              helperText="This will be the bot's display name and identity"
            />
            
            <Textarea
              name="personalityDescription"
              label="Personality Description"
              value={formData.personalityDescription}
              onChange={handleInputChange}
              placeholder="Describe the bot's personality, tone, and behavior..."
              rows={6}
              required
              helperText="Be specific about how the bot should interact with users"
            />
            
            <div className="flex justify-end">
              <Button 
                type="submit"
                loading={isSubmitting}
                icon={<FileText className="h-4 w-4" />}
              >
                {isSubmitting ? 'Saving...' : 'Save Persona'}
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}

export default Persona;