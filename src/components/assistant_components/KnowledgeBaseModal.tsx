import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Trash2, Database, File, Loader2, AlertCircle } from 'lucide-react';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Document {
  id: number;
  filename: string;
  file_type: string;
  collection_name: string;
  created_at: string;
  chunk_count: number;
}

const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ isOpen, onClose }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pythonPort, setPythonPort] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get Python port on mount
  useEffect(() => {
    const getPythonPort = async () => {
      if (window.electron) {
        try {
          const port = await window.electron.getPythonPort();
          setPythonPort(port);
          console.log('Python port from Electron:', port);
          // Load documents once we have the port
          if (port) loadDocuments(port);
        } catch (error) {
          console.error('Could not get Python port from Electron:', error);
          setError('Could not connect to backend service');
        }
      }
    };
    getPythonPort();
  }, []);

  const loadDocuments = async (port: number) => {
    try {
      const response = await fetch(`http://0.0.0.0:${port}/documents`);
      if (!response.ok) throw new Error('Failed to load documents');
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error('Error loading documents:', error);
      setError('Failed to load documents');
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!pythonPort) {
      setError('Backend service not available');
      return;
    }

    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('collection_name', 'default_collection');
        formData.append('metadata', JSON.stringify({ source: 'user_upload' }));

        const response = await fetch(`http://0.0.0.0:${pythonPort}/documents/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        // Reload documents list
        await loadDocuments(pythonPort);
        
      } catch (error) {
        console.error('Upload error:', error);
        setError(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!pythonPort) {
      setError('Backend service not available');
      return;
    }

    try {
      const response = await fetch(`http://0.0.0.0:${pythonPort}/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Reload documents after deletion
      await loadDocuments(pythonPort);
    } catch (error) {
      console.error('Error deleting document:', error);
      setError('Failed to delete document');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glassmorphic rounded-2xl p-8 max-w-4xl w-full mx-4 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-sakura-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Knowledge Base
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload documents to enhance the assistant's knowledge
            </p>
            <button
              onClick={handleFileSelect}
              disabled={isUploading || !pythonPort}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Files</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.txt,.md,.csv"
            />
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sakura-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <File className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {doc.filename}
                    </div>
                    <div className="text-xs text-gray-500">
                      {doc.file_type} • {doc.chunk_count} chunks • 
                      Uploaded {new Date(doc.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {documents.length === 0 && !isUploading && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No documents uploaded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;
