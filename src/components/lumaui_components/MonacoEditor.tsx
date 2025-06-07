import React, { useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { FileText, Eye, EyeOff, Code, Zap, Settings, CheckCircle, AlertTriangle } from 'lucide-react';
import * as monaco from 'monaco-editor';
import { FileNode } from '../../types';

interface MonacoEditorProps {
  content: string;
  fileName: string;
  onChange: (content: string) => void;
  isPreviewVisible?: boolean;
  onTogglePreview?: () => void;
  showPreviewToggle?: boolean;
  projectFiles?: FileNode[];
  webContainer?: any;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ 
  content, 
  fileName, 
  onChange, 
  isPreviewVisible = false,
  onTogglePreview,
  showPreviewToggle = false,
  projectFiles = [],
  webContainer
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

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

  // Flatten file structure to get all file paths and contents
  const flattenFiles = useCallback((files: FileNode[]): Array<{path: string, content: string, isDirectory: boolean}> => {
    const result: Array<{path: string, content: string, isDirectory: boolean}> = [];
    
    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          result.push({ path: node.path, content: '', isDirectory: true });
          if (node.children) {
            traverse(node.children);
          }
        } else {
          result.push({ path: node.path, content: node.content || '', isDirectory: false });
        }
      }
    };
    
    traverse(files);
    return result;
  }, []);

  // Setup TypeScript compiler options and language service
  const setupTypeScriptLanguageService = useCallback(async (monacoInstance: typeof monaco) => {
    if (!monacoInstance || projectFiles.length === 0) return;

    try {
      // Get all project files
      const allFiles = flattenFiles(projectFiles);
    
    // Configure TypeScript compiler options
    const compilerOptions: monaco.languages.typescript.CompilerOptions = {
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      allowJs: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      declaration: false,
      declarationMap: false,
      sourceMap: false,
      outDir: './dist',
      removeComments: false,
      noImplicitAny: false,
      strictNullChecks: true,
      strictFunctionTypes: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: false,
      noImplicitOverride: true,
      allowUnreachableCode: false,
      allowUnusedLabels: false,
      exactOptionalPropertyTypes: false,
      noImplicitThis: true,
      useUnknownInCatchVariables: true,
      alwaysStrict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
             noPropertyAccessFromIndexSignature: false,
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
        '@/components/*': ['./src/components/*'],
        '@/utils/*': ['./src/utils/*'],
        '@/types/*': ['./src/types/*'],
        '@/services/*': ['./src/services/*'],
        '@/hooks/*': ['./src/hooks/*']
      }
    };

    // Set TypeScript compiler options
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    // Configure diagnostics
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
    });

    monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
    });

    // Add project files to Monaco's file system
    for (const file of allFiles) {
      if (!file.isDirectory && file.content) {
        const uri = monacoInstance.Uri.parse(`file:///${file.path}`);
        
        // Check if model already exists
        let model = monacoInstance.editor.getModel(uri);
        if (model) {
          // Update existing model
          model.setValue(file.content);
        } else {
          // Create new model
          const language = getLanguageFromFileName(file.path);
          model = monacoInstance.editor.createModel(file.content, language, uri);
        }
      }
    }

    // Add common React and Node.js type definitions
    const reactTypes = `
declare module 'react' {
  export interface Component<P = {}, S = {}> {}
  export interface FunctionComponent<P = {}> {
    (props: P): JSX.Element | null;
  }
  export const useState: <T>(initial: T) => [T, (value: T) => void];
  export const useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: any[]) => T;
  export const useMemo: <T>(factory: () => T, deps: any[]) => T;
  export const useRef: <T>(initial: T | null) => { current: T | null };
  export default React;
}

declare global {
  namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
`;

    const nodeTypes = `
declare module 'fs' {
  export function readFile(path: string, encoding: string): Promise<string>;
  export function writeFile(path: string, data: string): Promise<void>;
  export function mkdir(path: string, options?: any): Promise<void>;
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string): string;
  export function extname(path: string): string;
}
`;

    // Add type definitions
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(reactTypes, 'file:///node_modules/@types/react/index.d.ts');
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(nodeTypes, 'file:///node_modules/@types/node/index.d.ts');

    // Try to load package.json for dependency information
    const packageJsonFile = allFiles.find(f => f.path === 'package.json');
    if (packageJsonFile && packageJsonFile.content) {
      try {
        const packageJson = JSON.parse(packageJsonFile.content);
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Add basic type definitions for common dependencies
        if (dependencies['@types/react']) {
          // React types already added above
        }
        
        if (dependencies['tailwindcss']) {
          const tailwindTypes = `
declare module 'tailwindcss' {
  export interface Config {
    content: string[];
    theme?: any;
    plugins?: any[];
  }
  const config: Config;
  export default config;
}
`;
          monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(tailwindTypes, 'file:///node_modules/tailwindcss/index.d.ts');
        }

        if (dependencies['vite']) {
          const viteTypes = `
declare module 'vite' {
  export interface UserConfig {
    plugins?: any[];
    server?: any;
    build?: any;
  }
  export function defineConfig(config: UserConfig): UserConfig;
}
`;
          monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(viteTypes, 'file:///node_modules/vite/index.d.ts');
        }
      } catch (error) {
        console.warn('Failed to parse package.json for type definitions:', error);
      }
    }

    console.log(`✅ TypeScript language service configured with ${allFiles.length} project files`);
    } catch (error) {
      console.error('Failed to setup TypeScript language service:', error);
    }
  }, [projectFiles.length, flattenFiles, getLanguageFromFileName]);

  // Setup Monaco editor when it mounts
  const handleEditorDidMount = useCallback(async (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Setup TypeScript language service
    await setupTypeScriptLanguageService(monacoInstance);

    // Configure editor for better development experience
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      // Save command - could trigger auto-save
      console.log('Save command triggered');
    });

    // Add custom actions
    editor.addAction({
      id: 'format-document',
      label: 'Format Document',
      keybindings: [monacoInstance.KeyMod.Shift | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF],
      run: () => {
        editor.getAction('editor.action.formatDocument')?.run();
      }
    });

    // Configure hover provider for better IntelliSense
    monacoInstance.languages.registerHoverProvider(['typescript', 'javascript'], {
      provideHover: (model, position) => {
        // Custom hover information could be added here
        return null;
      }
    });

    // Auto-resize editor
    const resizeObserver = new ResizeObserver(() => {
      editor.layout();
    });
    
    const editorElement = editor.getDomNode();
    if (editorElement?.parentElement) {
      resizeObserver.observe(editorElement.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [setupTypeScriptLanguageService]);

  // Update language service when project files change (with debouncing)
  useEffect(() => {
    if (!monacoRef.current || projectFiles.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      setupTypeScriptLanguageService(monacoRef.current!);
    }, 500); // Debounce for 500ms
    
    return () => clearTimeout(timeoutId);
  }, [projectFiles.length, setupTypeScriptLanguageService]); // Only depend on file count, not the entire array

  // Get editor diagnostics for current file
  const getDiagnostics = useCallback(() => {
    if (!monacoRef.current || !fileName) return [];
    
    const uri = monacoRef.current.Uri.parse(`file:///${fileName}`);
    const model = monacoRef.current.editor.getModel(uri);
    
    if (!model) return [];
    
    const markers = monacoRef.current.editor.getModelMarkers({ resource: uri });
    return markers;
  }, [fileName]);

  const diagnostics = getDiagnostics();
  const hasErrors = diagnostics.some(d => d.severity === monaco?.MarkerSeverity.Error);
  const hasWarnings = diagnostics.some(d => d.severity === monaco?.MarkerSeverity.Warning);

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
                {/* Diagnostics indicators */}
                {fileName && (
                  <div className="flex items-center gap-1">
                    {hasErrors && (
                      <div className="flex items-center gap-1 text-red-500" title={`${diagnostics.filter(d => d.severity === monaco?.MarkerSeverity.Error).length} errors`}>
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-xs">{diagnostics.filter(d => d.severity === monaco?.MarkerSeverity.Error).length}</span>
                      </div>
                    )}
                    {hasWarnings && (
                      <div className="flex items-center gap-1 text-yellow-500" title={`${diagnostics.filter(d => d.severity === monaco?.MarkerSeverity.Warning).length} warnings`}>
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-xs">{diagnostics.filter(d => d.severity === monaco?.MarkerSeverity.Warning).length}</span>
                      </div>
                    )}
                    {!hasErrors && !hasWarnings && fileName && (
                      <div className="flex items-center gap-1 text-green-500" title="No issues">
                        <CheckCircle className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {fileName ? (
                  <>
                    {projectFiles.length > 0 ? 'IntelliSense enabled' : 'Ready to edit'}
                    {projectFiles.length > 0 && (
                      <span className="ml-2 text-green-600 dark:text-green-400">
                        • {projectFiles.filter(f => f.type === 'file').length} files indexed
                      </span>
                    )}
                  </>
                ) : (
                  'Select a file to start editing'
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {fileName && projectFiles.length > 0 && (
              <button
                onClick={() => setupTypeScriptLanguageService(monacoRef.current!)}
                className="p-2 glassmorphic-card border border-white/30 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-sakura-500 dark:hover:text-sakura-400 rounded-lg transition-all duration-200 hover:shadow-md transform hover:scale-105"
                title="Refresh IntelliSense"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {showPreviewToggle && onTogglePreview && (
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
            )}
          </div>
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
            onMount={handleEditorDidMount}
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
                showFunctions: true,
                showConstructors: true,
                showFields: true,
                showVariables: true,
                showClasses: true,
                showStructs: true,
                showInterfaces: true,
                showModules: true,
                showProperties: true,
                showEvents: true,
                showOperators: true,
                showUnits: true,
                showValues: true,
                showConstants: true,
                showEnums: true,
                showEnumMembers: true,
                showColors: true,
                showFiles: true,
                showReferences: true,
                showFolders: true,
                showTypeParameters: true,
                showIssues: true,
                showUsers: true,
                showWords: true,
              },
              quickSuggestions: {
                other: true,
                comments: true,
                strings: true
              },
              parameterHints: {
                enabled: true,
                cycle: true
              },
              hover: {
                enabled: true,
                delay: 300
              },
                                            lightbulb: {
                 enabled: 'on' as any
               },
              padding: { top: 16, bottom: 16 },
              fontFamily: '"Fira Code", "Monaco", "Menlo", "Ubuntu Mono", monospace',
              fontLigatures: true,
              cursorBlinking: 'smooth',
              renderLineHighlight: 'gutter',
              smoothScrolling: true,
              mouseWheelZoom: true,
              contextmenu: true,
              copyWithSyntaxHighlighting: true,
              links: true,
              colorDecorators: true,
              dragAndDrop: true,
              showFoldingControls: 'always',
              foldingStrategy: 'indentation',
              showUnused: true,
              bracketPairColorization: {
                enabled: true
              },
              guides: {
                bracketPairs: true,
                bracketPairsHorizontal: true,
                highlightActiveBracketPair: true,
                indentation: true,
                highlightActiveIndentation: true
              },
              inlineSuggest: {
                enabled: true
              },
              stickyScroll: {
                enabled: true
              }
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
                <span>Powered by Monaco Editor with TypeScript Language Service</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonacoEditor; 