import React from 'react';
import Editor from '@monaco-editor/react';
import { FileText, Eye, EyeOff, Code, Zap } from 'lucide-react';

interface MonacoEditorProps {
  content: string;
  fileName: string;
  onChange: (content: string) => void;
  isPreviewVisible?: boolean;
  onTogglePreview?: () => void;
  showPreviewToggle?: boolean;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ 
  content, 
  fileName, 
  onChange, 
  isPreviewVisible = false,
  onTogglePreview,
  showPreviewToggle = false
}) => {
  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'ts':
        return 'typescript';
      case 'jsx':
      case 'js':
        return 'javascript';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  const getFileTypeIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'ts':
      case 'jsx':
      case 'js':
        return <Code className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileText className="w-4 h-4 text-sakura-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col glassmorphic">
      {/* Enhanced Header */}
      <div className="glassmorphic-card border-b border-white/20 dark:border-gray-700/50 shrink-0 h-14">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-lg flex items-center justify-center">
              {getFileTypeIcon(fileName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {fileName || 'No file selected'}
                </span>
                {fileName && (
                  <span className="text-xs px-2 py-0.5 bg-sakura-100 dark:bg-sakura-900/30 text-sakura-700 dark:text-sakura-300 rounded-full font-medium">
                    {getLanguageFromFileName(fileName)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {fileName ? 'Ready to edit' : 'Select a file to start editing'}
              </p>
            </div>
          </div>
          
          {showPreviewToggle && onTogglePreview && (
            <div className="flex items-center gap-2">
              <button
                onClick={onTogglePreview}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 ${
                  isPreviewVisible
                    ? 'bg-gradient-to-r from-sakura-500 to-pink-500 text-white shadow-sakura-500/25'
                    : 'glassmorphic-card border border-white/30 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:text-sakura-600 dark:hover:text-sakura-400'
                }`}
                title={isPreviewVisible ? 'Show Editor' : 'Show Preview'}
              >
                {isPreviewVisible ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Editor</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Preview</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative overflow-hidden bg-white dark:bg-gray-900">
        {fileName ? (
          <Editor
            height="100%"
            language={getLanguageFromFileName(fileName)}
            value={content}
            onChange={(value) => onChange(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              automaticLayout: true,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              folding: true,
              autoIndent: 'full',
              formatOnPaste: true,
              formatOnType: true,
              suggest: {
                showKeywords: true,
                showSnippets: true,
              },
              padding: { top: 16, bottom: 16 },
              fontFamily: '"Fira Code", "Monaco", "Menlo", "Ubuntu Mono", monospace',
              fontLigatures: true,
              cursorBlinking: 'smooth',
              renderLineHighlight: 'gutter',
              smoothScrolling: true,
            }}
          />
        ) : (
          /* Empty State */
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                <Code className="w-10 h-10 text-sakura-600 dark:text-sakura-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
                Ready to Code
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Select a file from the explorer to start editing. The Monaco editor supports syntax highlighting, IntelliSense, and more.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Zap className="w-4 h-4" />
                <span>Powered by Monaco Editor</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonacoEditor; 