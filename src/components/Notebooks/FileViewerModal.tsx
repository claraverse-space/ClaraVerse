import React, { useState, useEffect } from 'react';
import { X, FileText, AlertCircle, Download, Eye, Calendar, HardDrive } from 'lucide-react';
import { notebookFileStorage, StoredFile } from '../../services/notebookFileStorage';

interface FileViewerModalProps {
  documentId: string;
  filename: string;
  onClose: () => void;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({
  documentId,
  filename,
  onClose
}) => {
  const [storedFile, setStoredFile] = useState<StoredFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    loadFile();
    return () => {
      // Cleanup blob URL on unmount
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [documentId]);

  const loadFile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const file = await notebookFileStorage.getFile(documentId);
      
      if (!file) {
        setError('File not available in local storage');
        setIsLoading(false);
        return;
      }

      setStoredFile(file);

      // Create blob URL for viewing
      const url = notebookFileStorage.createBlobUrl(file.content, file.fileType);
      setBlobUrl(url);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file');
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!storedFile || !blobUrl) return;

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = storedFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isTextFile = (fileType: string): boolean => {
    return fileType.startsWith('text/') || fileType === 'application/json';
  };

  const isPdfFile = (fileType: string): boolean => {
    return fileType === 'application/pdf';
  };

  const renderFileContent = () => {
    if (!storedFile || !blobUrl) return null;

    if (isTextFile(storedFile.fileType)) {
      const textContent = typeof storedFile.content === 'string' 
        ? storedFile.content 
        : notebookFileStorage.arrayBufferToText(storedFile.content as ArrayBuffer);

      return (
        <div className="h-96 glassmorphic bg-white/60 dark:bg-gray-800/60 rounded-xl border border-white/30 dark:border-gray-700/30 overflow-hidden">
          <div className="h-full p-4 overflow-y-auto custom-scrollbar">
            <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono leading-relaxed">
              {textContent}
            </pre>
          </div>
        </div>
      );
    }

    if (isPdfFile(storedFile.fileType)) {
      return (
        <div className="h-96 glassmorphic bg-white/60 dark:bg-gray-800/60 rounded-xl border border-white/30 dark:border-gray-700/30 overflow-hidden">
          <iframe
            src={blobUrl}
            className="w-full h-full rounded-xl"
            title={`PDF Viewer - ${storedFile.filename}`}
          />
        </div>
      );
    }

    // For other file types, show file info
    return (
      <div className="h-48 glassmorphic bg-white/60 dark:bg-gray-800/60 rounded-xl border border-white/30 dark:border-gray-700/30 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Binary file - Use download button to save locally
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="glassmorphic bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/30 dark:border-gray-700/30">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-gray-800/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl text-white shadow-lg">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                File Viewer
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {filename}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {storedFile && blobUrl && (
              <button
                onClick={handleDownload}
                className="p-3 glassmorphic bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-xl transition-all duration-200 border border-white/30 dark:border-gray-700/30 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shadow-lg"
                title="Download file"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-3 glassmorphic bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-2xl transition-all duration-200 border border-white/30 dark:border-gray-700/30 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar max-h-[calc(90vh-200px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 rounded-xl p-8 border border-white/30 dark:border-gray-700/30 shadow-lg backdrop-blur-xl">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading file...</span>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="glassmorphic bg-red-50/90 dark:bg-red-900/40 border border-red-200/50 dark:border-red-700/30 rounded-xl p-6 backdrop-blur-xl shadow-lg">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-2">
                    File Not Available Locally
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mb-4 leading-relaxed">
                    This file is not stored in your local database. It may have been uploaded before local storage was enabled, or the local data may have been cleared.
                  </p>
                  <div className="glassmorphic bg-white/60 dark:bg-red-800/30 rounded-lg p-3 border border-red-200/50 dark:border-red-600/30">
                    <p className="text-xs text-red-600 dark:text-red-300 font-medium">
                      <strong>Note:</strong> The file is still available on the server and will be processed normally for chat queries. Local storage is only for quick file viewing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : storedFile ? (
            <>
              {/* File Info */}
              <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-4 rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-blue-500" />
                  File Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Filename</div>
                    <div className="font-semibold text-gray-900 dark:text-white truncate">{storedFile.filename}</div>
                  </div>
                  <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">File Type</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{storedFile.fileType}</div>
                  </div>
                  <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Size</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{formatFileSize(storedFile.size)}</div>
                  </div>
                  <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Uploaded
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-white text-sm">{formatDate(storedFile.uploadDate)}</div>
                  </div>
                </div>
              </div>

              {/* File Content */}
              <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-lg overflow-hidden">
                <div className="p-4 border-b border-white/20 dark:border-gray-700/20">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    File Preview
                  </h3>
                </div>
                <div className="p-4">
                  {renderFileContent()}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;
