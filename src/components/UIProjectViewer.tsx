import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Maximize, Minimize, X, Terminal, RefreshCw, Edit, Eye, Copy, Download, Share2 } from 'lucide-react';
import { uiBuilderService, UIBuilderProject } from '../services/UIBuilderService';

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
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDevToolsTooltip, setShowDevToolsTooltip] = useState(false);
  const [previewError, setPreviewError] = useState<{message: string; line: number; column: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Add states for tooltips
  const [tooltips, setTooltips] = useState<Record<string, boolean>>({
    back: false,
    refresh: false,
    edit: false,
    fullscreen: false,
    devtools: false,
    copy: false,
    share: false,
    download: false
  });
  
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

  const handleShare = () => {
    if (!project) return;
    
    const toastEl = document.createElement('div');
    toastEl.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl z-50 max-w-md w-full';
    toastEl.innerHTML = `
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Share "${project.name || 'UI Project'}"</h3>
      <p class="mb-4 text-gray-700 dark:text-gray-300">You can export this project to share it with others.</p>
      <div class="flex justify-end">
        <button id="share-close" class="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors">Close</button>
      </div>
    `;
    
    // Create a semi-transparent backdrop
    const backdropEl = document.createElement('div');
    backdropEl.className = 'fixed inset-0 bg-black bg-opacity-50 z-40';
    
    document.body.appendChild(backdropEl);
    document.body.appendChild(toastEl);
    
    document.getElementById('share-close')?.addEventListener('click', () => {
      document.body.removeChild(toastEl);
      document.body.removeChild(backdropEl);
    });
    
    backdropEl.addEventListener('click', () => {
      document.body.removeChild(toastEl);
      document.body.removeChild(backdropEl);
    });
  };

  // Show tooltip handler
  const handleShowTooltip = (key: string) => {
    setTooltips(prev => ({ ...prev, [key]: true }));
  };
  
  // Hide tooltip handler
  const handleHideTooltip = (key: string) => {
    setTooltips(prev => ({ ...prev, [key]: false }));
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
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-white flex flex-col"
    >
      {/* Improved uniform control bar that fades out when not hovered */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/40 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            {/* Back button */}
            <button 
              onClick={handleBack}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title="Back to Apps"
              onMouseEnter={() => handleShowTooltip('back')}
              onMouseLeave={() => handleHideTooltip('back')}
            >
              <ArrowLeft size={18} />
              {tooltips.back && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  Back to Apps
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </button>
            
            {project && (
              <div className="ml-2 text-white text-sm font-medium truncate max-w-[150px] md:max-w-[300px]">
                {project.name}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button 
              onClick={updatePreview}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title="Refresh Preview"
              onMouseEnter={() => handleShowTooltip('refresh')}
              onMouseLeave={() => handleHideTooltip('refresh')}
            >
              <RefreshCw size={18} />
              {tooltips.refresh && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  Refresh Preview
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </button>
            
            {/* Edit button */}
            <button 
              onClick={handleEdit}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title="Edit Project"
              onMouseEnter={() => handleShowTooltip('edit')}
              onMouseLeave={() => handleHideTooltip('edit')}
            >
              <Edit size={18} />
              {tooltips.edit && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  Edit Project
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </button>
            
            {/* Copy Code button */}
            <button 
              onClick={handleCopyCode}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title="Copy Code"
              onMouseEnter={() => handleShowTooltip('copy')}
              onMouseLeave={() => handleHideTooltip('copy')}
            >
              <Copy size={18} />
              {tooltips.copy && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  Copy Code
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </button>
            
            {/* Download HTML button */}
            <button 
              onClick={handleDownload}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title="Download HTML"
              onMouseEnter={() => handleShowTooltip('download')}
              onMouseLeave={() => handleHideTooltip('download')}
            >
              <Download size={18} />
              {tooltips.download && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  Download HTML
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </button>
            
            {/* Share button */}
            <button 
              onClick={handleShare}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title="Share Project"
              onMouseEnter={() => handleShowTooltip('share')}
              onMouseLeave={() => handleHideTooltip('share')}
            >
              <Share2 size={18} />
              {tooltips.share && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  Share Project
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </button>
            
            {/* DevTools button - only shown in Electron mode */}
            {isElectron && (
              <button 
                onClick={handleOpenDevTools}
                className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
                title="Open DevTools"
                onMouseEnter={() => handleShowTooltip('devtools')}
                onMouseLeave={() => handleHideTooltip('devtools')}
              >
                <Terminal size={18} />
                {tooltips.devtools && (
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                    Open DevTools
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                  </div>
                )}
              </button>
            )}
            
            {/* Fullscreen button */}
            <button 
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              onMouseEnter={() => handleShowTooltip('fullscreen')}
              onMouseLeave={() => handleHideTooltip('fullscreen')}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              {tooltips.fullscreen && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </button>
            
            {/* Close button */}
            <button 
              onClick={handleBack}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors relative"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Project content - taking the full screen */}
      <div className="flex-1 overflow-hidden">
        {previewError && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-2 text-sm">
            Error on line {previewError.line}: {previewError.message}
          </div>
        )}
        
        {isElectron ? (
          <webview
            ref={webviewRef}
            src="/preview.html"
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
            src="/preview.html"
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
            title="Preview"
          />
        )}
      </div>
    </div>
  );
};

export default UIProjectViewer; 