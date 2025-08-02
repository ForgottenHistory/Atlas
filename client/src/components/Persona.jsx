import { useState, useEffect } from 'react';
import { User, FileText, Upload, Tag, MessageSquare } from 'lucide-react';
import { Button, Input, Textarea, Alert, Card, Modal, Badge } from './shared';
import CharacterUpload from './persona/CharacterUpload';

function Persona({ onUpdatePersona }) {
  const [formData, setFormData] = useState({
    characterName: '',
    personalityDescription: '',
    mes_example: '',
    creator_notes: '',
    tags: [],
    creator: '',
    character_version: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Load current persona data on component mount
  useEffect(() => {
    loadPersonaData();
  }, []);

  const loadPersonaData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/persona');
      const result = await response.json();
      
      if (result.success && result.data) {
        const persona = result.data;
        setFormData({
          characterName: persona.name || '',
          personalityDescription: persona.description || '',
          mes_example: persona.mes_example || '',
          creator_notes: persona.creator_notes || '',
          tags: Array.isArray(persona.tags) ? persona.tags : [],
          creator: persona.creator || '',
          character_version: persona.character_version || ''
        });
      }
    } catch (error) {
      console.error('Error loading persona data:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to load current persona data. You can still edit and save.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await onUpdatePersona({
        name: formData.characterName,
        description: formData.personalityDescription,
        mes_example: formData.mes_example,
        creator_notes: formData.creator_notes,
        tags: formData.tags,
        creator: formData.creator,
        character_version: formData.character_version
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

  const handleCharacterLoaded = (characterData) => {
    // Fill form with character data
    setFormData({
      characterName: characterData.name || '',
      personalityDescription: characterData.description || '',
      mes_example: characterData.mes_example || '',
      creator_notes: characterData.creator_notes || '',
      tags: Array.isArray(characterData.tags) ? characterData.tags : [],
      creator: characterData.creator || '',
      character_version: characterData.character_version || ''
    });
    
    setMessage({ 
      type: 'success', 
      text: `Character "${characterData.name}" loaded successfully!` 
    });
  };

  const clearMessage = () => setMessage({ type: '', text: '' });

  // Show loading state
  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Bot Persona</h2>
        
        <Card>
          <Card.Content>
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading persona data...</p>
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  }

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
          <div className="flex items-center justify-between">
            <div>
              <Card.Title>Configure Your Bot's Personality</Card.Title>
              <p className="text-gray-400 text-sm mt-1">
                Define how your bot should behave and respond to users
              </p>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowUploadModal(true)}
              icon={<Upload className="h-4 w-4" />}
            >
              Upload Character
            </Button>
          </div>
        </Card.Header>
        
        <Card.Content>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Required Fields */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
                Required Information
              </h4>
              
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
                rows={4}
                required
                helperText="Be specific about how the bot should interact with users"
              />
              
              <Textarea
                name="mes_example"
                label="Message Examples"
                value={formData.mes_example}
                onChange={handleInputChange}
                placeholder="Example messages or dialogue from this character..."
                rows={4}
                icon={<MessageSquare className="h-4 w-4" />}
                helperText="Examples of how the character speaks and responds"
              />
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
                Optional Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="creator"
                  label="Creator"
                  value={formData.creator}
                  onChange={handleInputChange}
                  placeholder="Character creator name..."
                  helperText="Who created this character"
                />
                
                <Input
                  name="character_version"
                  label="Character Version"
                  value={formData.character_version}
                  onChange={handleInputChange}
                  placeholder="v1.0"
                  helperText="Version of this character"
                />
              </div>
              
              <Textarea
                name="creator_notes"
                label="Creator Notes"
                value={formData.creator_notes}
                onChange={handleInputChange}
                placeholder="Additional notes from the character creator..."
                rows={3}
                helperText="Any additional information about the character"
              />
              
              {/* Tags Section */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-200">
                  Tags
                </label>
                
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    variant="outline"
                    icon={<Tag className="h-4 w-4" />}
                  >
                    Add
                  </Button>
                </div>
                
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="primary-dark"
                        className="flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-red-300"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-gray-400">
                  Tags help categorize and organize characters
                </p>
              </div>
            </div>
            
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

      {/* Character Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Character Card"
        size="md"
      >
        <CharacterUpload
          onCharacterLoaded={handleCharacterLoaded}
          onClose={() => setShowUploadModal(false)}
        />
      </Modal>
    </div>
  );
}

export default Persona;