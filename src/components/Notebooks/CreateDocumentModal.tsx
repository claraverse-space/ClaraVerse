import React, { useState, useRef } from 'react';
import { X, FileText, Upload, AlertCircle, Check } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface CreateDocumentModalProps {
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onTextFileCreated?: (filename: string, content: string, documentId: string) => void;
}

const CreateDocumentModal: React.FC<CreateDocumentModalProps> = ({
  onClose,
  onUpload,
  onTextFileCreated
}) => {
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    // Focus the editor
    editor.focus();
  };

  const createTextFile = (content: string, filename: string): File => {
    const blob = new Blob([content], { type: 'text/plain' });
    const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    return new File([blob], finalFilename, {
      type: 'text/plain',
      lastModified: Date.now()
    });
  };

  const handleSave = () => {
    // Validation
    if (!filename.trim()) {
      setError('Please enter a filename');
      return;
    }

    if (!content.trim()) {
      setError('Please enter some content');
      return;
    }

    setError(null);
    setShowConfirmation(true);
  };

  const handleConfirmUpload = async () => {
    setIsUploading(true);
    setError(null);

    try {
      const textFile = createTextFile(content.trim(), filename.trim());
      await onUpload([textFile]);
      onClose(); // Close modal on success
    } catch (error) {
      console.error('Failed to upload document:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload document');
      setShowConfirmation(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const getWordCount = () => {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getCharCount = () => {
    return content.length;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="glassmorphic bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/30 dark:border-gray-700/30">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-gray-800/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-sakura-500 to-pink-500 rounded-2xl text-white shadow-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-sakura-600 to-pink-600 dark:from-sakura-400 dark:to-pink-400 bg-clip-text text-transparent">
                Create New Document
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Write your content and save it as a text document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 glassmorphic bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-2xl transition-all duration-200 border border-white/30 dark:border-gray-700/30 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar max-h-[calc(90vh-200px)]">
          {/* Filename Input */}
          <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-4 rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-lg">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Document Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Enter filename (e.g., 'My Notes')"
                className="w-full px-4 py-3 glassmorphic bg-white/60 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-xl border border-white/30 dark:border-gray-700/30 focus:outline-none focus:ring-2 focus:ring-sakura-500/50 focus:border-sakura-500/50 transition-all backdrop-blur-sm shadow-md"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                .txt
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/20 dark:border-gray-700/20">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Document Content
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="glassmorphic bg-white/60 dark:bg-gray-700/60 px-3 py-1 rounded-lg border border-white/30 dark:border-gray-600/30">
                  {getWordCount()} words
                </span>
                <span className="glassmorphic bg-white/60 dark:bg-gray-700/60 px-3 py-1 rounded-lg border border-white/30 dark:border-gray-600/30">
                  {getCharCount()} characters
                </span>
              </div>
            </div>
            
            <div className="h-96 relative">
              <Editor
                height="100%"
                defaultLanguage="plaintext"
                theme="vs-dark"
                value={content}
                onChange={(value) => setContent(value || '')}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  fontSize: 14,
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  insertSpaces: true,
                  renderWhitespace: 'selection',
                  smoothScrolling: true
                }}
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="glassmorphic bg-red-50/90 dark:bg-red-900/40 border border-red-200/50 dark:border-red-700/30 rounded-xl p-4 backdrop-blur-xl shadow-md">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-white/20 dark:border-gray-800/30 bg-white/40 dark:bg-gray-900/40">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Document will be saved as <span className="font-semibold text-gray-900 dark:text-white">{filename || 'untitled'}.txt</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 glassmorphic bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-all duration-200 border border-gray-500/30 shadow-lg hover:shadow-xl font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!filename.trim() || !content.trim()}
              className="px-6 py-3 glassmorphic bg-gradient-to-r from-sakura-600 to-pink-600 hover:from-sakura-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl border border-sakura-500/30 disabled:border-gray-400/30 font-semibold flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Create & Upload
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-60">
          <div className="glassmorphic bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-2xl shadow-2xl p-6 border border-white/30 dark:border-gray-700/30 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Confirm Upload
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Ready to create and upload your document?
                </p>
              </div>
            </div>

            <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 mb-6 border border-white/30 dark:border-gray-700/30">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Filename:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{filename}.txt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Size:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{getWordCount()} words, {getCharCount()} characters</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Type:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Plain Text (.txt)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelConfirmation}
                disabled={isUploading}
                className="flex-1 px-4 py-3 glassmorphic bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-xl transition-all duration-200 border border-gray-500/30 shadow-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="flex-1 px-4 py-3 glassmorphic bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-xl transition-all duration-200 shadow-lg border border-green-500/30 font-semibold flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateDocumentModal;
