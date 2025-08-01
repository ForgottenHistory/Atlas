import { useState, useRef } from 'react';
import { Upload, FileImage, X, User } from 'lucide-react';
import { Button, Alert } from '../shared';
import { characterImageParser } from '../../utils/characterImageParser';

function CharacterUpload({ onCharacterLoaded, onClose }) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file) => {
    setError('');
    setLoading(true);
    setPreviewData(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Parse character card from image
      console.log('Parsing character card from image...');
      const characterCard = await characterImageParser.extractFromPNG(file);
      
      if (!characterCard) {
        throw new Error('No character card data found in this image. Make sure it\'s a PNG with embedded Character Card v2 data.');
      }

      // Create preview with character data
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewData({
          name: file.name,
          size: file.size,
          preview: e.target.result,
          file: file,
          characterData: characterCard.data
        });
        setLoading(false);
      };
      reader.readAsDataURL(file);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!previewData?.characterData) return;

    setLoading(true);
    setError('');

    try {
      // Send extracted character data to backend
      const response = await fetch('http://localhost:3001/api/persona', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: previewData.characterData.name || '',
          description: previewData.characterData.description || '',
          mes_example: previewData.characterData.mes_example || '',
          creator_notes: previewData.characterData.creator_notes || '',
          tags: Array.isArray(previewData.characterData.tags) ? previewData.characterData.tags : [],
          creator: previewData.characterData.creator || '',
          character_version: previewData.characterData.character_version || ''
        })
      });

      const result = await response.json();

      if (result.success) {
        onCharacterLoaded(previewData.characterData);
        onClose();
      } else {
        setError(result.error || 'Failed to save character data');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    setPreviewData(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <FileImage className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold mb-2">Upload Character Card</h3>
        <p className="text-gray-400 text-sm">
          Upload a PNG image with embedded Character Card v2 data
        </p>
      </div>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      {!previewData ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-blue-400 bg-blue-400 bg-opacity-10' 
              : 'border-gray-600 hover:border-gray-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <div className="space-y-2">
            <p className="text-gray-300">
              Drop your character image here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                browse files
              </button>
            </p>
            <p className="text-xs text-gray-500">
              Supports PNG files with embedded character data
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-4">
            <img
              src={previewData.preview}
              alt="Character preview"
              className="w-20 h-20 rounded-lg object-cover"
            />
            
            <div className="flex-1">
              <h4 className="font-medium text-white">{previewData.name}</h4>
              <p className="text-sm text-gray-400">
                {(previewData.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {previewData.characterData ? (
                <div className="text-xs text-green-400 mt-1">
                  ✓ Character: {previewData.characterData.name}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Ready to extract character data
                </p>
              )}
            </div>
            
            <button
              onClick={clearPreview}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        
        {previewData && (
          <Button
            onClick={handleUpload}
            loading={loading}
            disabled={!previewData.characterData}
            icon={<User className="h-4 w-4" />}
          >
            {previewData.characterData ? 'Load Character' : 'No Character Data'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default CharacterUpload;