import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { editor, KeyMod, KeyCode } from 'monaco-editor';

interface MonacoEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  language?: string;
  theme?: string;
  height?: string;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  content,
  onChange,
  placeholder = "Start writing...",
  className = "",
  readOnly = false,
  language = "markdown",
  theme = "vs-dark",
  height = "100%"
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    setIsEditorReady(true);
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 1.6,
      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
      wordWrap: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 16, bottom: 16 },
      lineNumbers: 'off',
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 0,
      renderLineHighlight: 'none',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
    });

    // Add markdown snippets and shortcuts
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyB, () => {
      const selection = editor.getSelection();
      if (selection) {
        const selectedText = editor.getModel()?.getValueInRange(selection) || '';
        editor.executeEdits('bold', [{
          range: selection,
          text: `**${selectedText}**`
        }]);
      }
    });

    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyI, () => {
      const selection = editor.getSelection();
      if (selection) {
        const selectedText = editor.getModel()?.getValueInRange(selection) || '';
        editor.executeEdits('italic', [{
          range: selection,
          text: `*${selectedText}*`
        }]);
      }
    });

    // Add placeholder functionality
    if (!content && placeholder) {
      editor.setValue(`<!-- ${placeholder} -->\n`);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      // Remove placeholder if it exists
      if (value.startsWith(`<!-- ${placeholder} -->\n`)) {
        const cleanValue = value.replace(`<!-- ${placeholder} -->\n`, '');
        if (cleanValue.trim()) {
          onChange(cleanValue);
        } else {
          onChange('');
        }
      } else {
        onChange(value);
      }
    }
  };

  // Update editor content when prop changes
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.getValue()) {
      editorRef.current.setValue(content || '');
    }
  }, [content]);

  return (
    <div className={`rich-editor-container ${className}`} style={{ height: '100%' }}>
      <Editor
        height={height}
        language={language}
        theme={theme}
        value={content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <div className="text-gray-500 dark:text-gray-400">Loading Monaco Editor...</div>
          </div>
        }
        options={{
          readOnly,
          contextmenu: true,
          selectOnLineNumbers: false,
          roundedSelection: false,
          cursorStyle: 'line',
          automaticLayout: true,
        }}
      />
      
      <style>{`
        .rich-editor-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: white;
        }
        
        .dark .rich-editor-container {
          background: #1f2937;
        }
        
        /* Custom scrollbar styling */
        :global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider) {
          background: rgba(0, 0, 0, 0.2) !important;
        }
        
        :global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider:hover) {
          background: rgba(0, 0, 0, 0.4) !important;
        }
        
        :global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider.active) {
          background: rgba(0, 0, 0, 0.6) !important;
        }
      `}</style>
    </div>
  );
};

export default MonacoEditor; 