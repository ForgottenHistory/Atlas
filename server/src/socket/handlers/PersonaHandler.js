class PersonaHandler {
  constructor(io, storage) {
    this.io = io;
    this.storage = storage;
  }

  async handleUpdatePersona(socket, personaData) {
    try {
      console.log('Persona updated via socket:', personaData);
      
      const validation = this._validatePersonaData(personaData);
      if (!validation.isValid) {
        socket.emit('personaUpdated', { success: false, error: validation.error });
        return;
      }

      const updates = {
        name: personaData.name.trim(),
        description: personaData.description.trim()
      };
      
      const success = await this.storage.updatePersona(updates);
      
      if (success) {
        const activity = await this.storage.addActivity(`Persona updated: ${personaData.name}`);
        
        socket.emit('personaUpdated', { success: true, data: this.storage.getPersona() });
        this.io.emit('newActivity', activity);
      } else {
        socket.emit('personaUpdated', { success: false, error: 'Failed to save persona' });
      }
    } catch (error) {
      console.error('Error updating persona:', error);
      socket.emit('personaUpdated', { success: false, error: 'Server error' });
    }
  }

  _validatePersonaData(personaData) {
    if (!personaData.name || !personaData.description) {
      return { isValid: false, error: 'Name and description required' };
    }

    if (personaData.name.trim().length === 0) {
      return { isValid: false, error: 'Name cannot be empty' };
    }

    if (personaData.description.trim().length === 0) {
      return { isValid: false, error: 'Description cannot be empty' };
    }

    return { isValid: true };
  }
}

module.exports = PersonaHandler;