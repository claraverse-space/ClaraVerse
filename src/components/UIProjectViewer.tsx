import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Maximize, Minimize, X, Terminal, RefreshCw, Edit, Eye, Copy, Download } from 'lucide-react';
import { uiBuilderService, UIBuilderProject } from '../services/UIBuilderService';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface UIProjectViewerProps {
  onPageChange: (page: string) => void;
}

const isElectron = !!(window && window.process && window.process.type);

// Define a preload script for the webview to inject before page load
const preloadScript = `
  // Inject Tailwind CSS silently
  const tailwindScript = document.createElement('script');
  tailwindScript.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(tailwindScript);
  
  // Error handling and logging - only for actual errors
  window.onerror = function(message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.bottom = '0';
    errorDiv.style.left = '0';
    errorDiv.style.right = '0';
    errorDiv.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '10px';
    errorDiv.style.fontFamily = 'monospace';
    errorDiv.style.zIndex = '9999';
    errorDiv.textContent = \`ERROR: \${message} (line \${lineno}, col \${colno})\`;
    document.body.appendChild(errorDiv);
    return false;
  };
  
  // Silent fetch interception - only log actual errors
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args)
      .catch(error => {
        console.error('Fetch error:', error);
        throw error;
      });
  };
`;

const UIProjectViewer: React.FC<UIProjectViewerProps> = ({ onPageChange }) => {
  const [project, setProject] = useState<UIBuilderProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewError, setPreviewError] = useState<{message: string; line: number; column: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Define the updatePreview function
  const updatePreview = useCallback(() => {
    if (project) {
      if (isElectron && webviewRef.current) {
        webviewRef.current.executeJavaScript(`
          // Send message to update preview content
          window.postMessage({
            type: 'update-preview',
            html: ${JSON.stringify(project.htmlCode)},
            css: ${JSON.stringify(project.cssCode)},
            js: ${JSON.stringify(project.jsCode)}
          }, '*');
        `).catch((err: Error) => console.error('Failed to update preview:', err));
      } else if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'update-preview',
          html: project.htmlCode,
          css: project.cssCode,
          js: project.jsCode
        }, '*');
      }
    }
  }, [project]);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoading(true);
        const projectId = localStorage.getItem('current_ui_project');
        
        if (!projectId) {
          throw new Error('No project ID found');
        }
        
        const projectData = await uiBuilderService.getProjectById(projectId);
        setProject(projectData);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Failed to load project. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProject();
  }, []);

  // Open DevTools for the webview in Electron 
  useEffect(() => {
    if (isElectron && webviewRef.current && project) {
      const webview = webviewRef.current;
      const handleDomReady = () => {
        if (webview && webview.openDevTools) {
          console.log('Preparing preview webview');
          // Add the preload script to the webview when DOM is ready
          webview.executeJavaScript(preloadScript)
            .then(() => {
              console.log('Preload script injected successfully');
              // Update preview content after preload script is injected
              updatePreview();
            })
            .catch((err: Error) => console.error('Failed to inject preload script:', err));
        }
      };
      webview.addEventListener('dom-ready', handleDomReady);

      // Set up error listener
      const handleIpcMessage = (event: any) => {
        if (event.channel === 'console-log') {
          console.log('[Webview Console]:', event.args[0]);
        }
      };
      webview.addEventListener('ipc-message', handleIpcMessage);

      return () => {
        webview.removeEventListener('dom-ready', handleDomReady);
        webview.removeEventListener('ipc-message', handleIpcMessage);
      };
    }
  }, [project, updatePreview]);

  // Update preview when content changes for iframe
  useEffect(() => {
    if (project && !isElectron && iframeRef.current) {
      // Listen for error messages from the preview
      const handlePreviewError = (event: MessageEvent) => {
        if (event.data.type === 'preview-error') {
          setPreviewError(event.data.error);
        }
      };
      window.addEventListener('message', handlePreviewError);
      
      // Add a small delay to ensure iframe is ready
      const timeoutId = setTimeout(() => {
        updatePreview();
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('message', handlePreviewError);
      };
    }
  }, [project, updatePreview]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleBack = () => {
    onPageChange('apps');
  };
  
  const handleOpenDevTools = () => {
    if (isElectron && webviewRef.current && webviewRef.current.openDevTools) {
      webviewRef.current.openDevTools();
    }
  };
  
  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleEdit = () => {
    localStorage.setItem('current_ui_project', project?.id || '');
    onPageChange('ui-builder');
  };

  const handleCopyCode = () => {
    if (!project) return;
    
    const htmlContent = project.htmlCode || '';
    const cssContent = project.cssCode || '';
    const jsContent = project.jsCode || '';
    
    const fullCode = `<!--HTML-->
${htmlContent}

/*CSS*/
${cssContent}

/*JavaScript*/
${jsContent}`;
    
    navigator.clipboard.writeText(fullCode)
      .then(() => {
        // Show a temporary success message
        const toastEl = document.createElement('div');
        toastEl.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        toastEl.innerText = 'Code copied to clipboard!';
        document.body.appendChild(toastEl);
        
        setTimeout(() => {
          document.body.removeChild(toastEl);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy code:', err);
      });
  };

  const handleDownload = () => {
    if (!project) return;
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name || 'UI Project'}</title>
  <style>
    ${project.cssCode || ''}
  </style>
</head>
<body>
  ${project.htmlCode || ''}
  <script>
    ${project.jsCode || ''}
  </script>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'ui-project'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sakura-500"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-red-500 mb-4">{error || 'Project not found'}</div>
        <button 
          onClick={handleBack}
          className="px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg transition-colors"
        >
          Back to Apps
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-white via-sakura-50/80 to-blue-50/80 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar */}
      <Sidebar activePage="apps" onPageChange={onPageChange} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <Topbar 
          userName="User"
          onPageChange={onPageChange}
        />
        
        {/* Project Status Bar */}
        <div className="h-14 glassmorphic flex items-center justify-between px-6 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full animate-pulse shadow-lg shadow-emerald-400/30"></div>
                <div className="absolute inset-0 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {project?.name || "UI Project"}
                </span>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Project Viewer • Clara Apps
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Apps
            </button>
            
            <div className="w-px h-5 bg-gray-300/50 dark:bg-gray-600/50"></div>
            
            <button 
              onClick={updatePreview}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200"
              title="Refresh Preview"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            
            <button 
              onClick={handleEdit}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200"
              title="Edit Project"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            
            <button 
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200"
              title="Copy Code"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-200"
              title="Download HTML"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            
            {/* Fullscreen button */}
            <button 
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              {isFullscreen ? "Exit" : "Fullscreen"}
            </button>
          </div>
        </div>
        
        {/* Preview Content Area */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden glassmorphic"
        >
          {previewError && (
            <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-4 text-sm flex items-center gap-3 shadow-lg">
              <span className="font-medium">Error on line {previewError.line}: {previewError.message}</span>
            </div>
          )}
          
          {isElectron ? (
            <webview
              ref={webviewRef}
              src="./preview.html"
              style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
              allowpopups={true}
              nodeintegration={true}
              webpreferences="contextIsolation=false, webSecurity=false, allowRunningInsecureContent=true, nodeIntegration=true"
              disablewebsecurity={true}
              partition="persist:preview"
            />
          ) : (
            <iframe
              ref={iframeRef}
              src="./preview.html"
              className="w-full h-full border-none bg-white rounded-lg shadow-lg"
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
              title="Preview"
            />
          )}
          
          {/* DevTools button - floating in bottom right for Electron */}
          {isElectron && (
            <button 
              onClick={handleOpenDevTools}
              className="absolute bottom-4 right-4 p-3 rounded-full bg-gray-800/80 text-white hover:bg-gray-700/80 transition-colors shadow-lg backdrop-blur-sm"
              title="Open DevTools"
            >
              <Terminal className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UIProjectViewer; 