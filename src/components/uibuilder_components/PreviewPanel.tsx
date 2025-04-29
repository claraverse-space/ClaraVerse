import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LayoutGrid, Terminal } from 'lucide-react';

interface UIElement {
  id: string;
  type: string;
  props: any;
  children?: UIElement[];
}

interface PreviewPanelProps {
  elements: UIElement[];
  htmlContent?: string; // Optional HTML content prop
  cssContent?: string;  // Optional CSS content prop
  jsContent?: string;   // Optional JS content prop
}

const isElectron = !!(window && window.process && window.process.type);

// Define a preload script for the webview to inject before page load
const preloadScript = `
  // Inject Tailwind CSS
  const tailwindScript = document.createElement('script');
  tailwindScript.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(tailwindScript);
  
  // Error handling and logging
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
    console.error("PREVIEW ERROR:", message, error);
    return false;
  };
  
  // Intercept fetch to log network activity
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    console.log('Fetch request:', args);
    return originalFetch.apply(this, args)
      .then(response => {
        console.log('Fetch response:', response);
        return response;
      })
      .catch(error => {
        console.error('Fetch error:', error);
        throw error;
      });
  };
  
  // Log when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
  });
`;

const PreviewPanel: React.FC<PreviewPanelProps> = ({ elements, htmlContent, cssContent, jsContent }) => {
  const webviewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [previewError, setPreviewError] = useState<{message: string; line: number; column: number} | null>(null);

  // Define the updatePreview function similar to UIBuilder.tsx
  const updatePreview = useCallback(() => {
    // Only send content if we have explicit content props
    if (htmlContent && cssContent && jsContent) {
      if (isElectron && webviewRef.current) {
        webviewRef.current.executeJavaScript(`
          // Send message to update preview content
          window.postMessage({
            type: 'update-preview',
            html: ${JSON.stringify(htmlContent)},
            css: ${JSON.stringify(cssContent)},
            js: ${JSON.stringify(jsContent)}
          }, '*');
        `).catch((err: Error) => console.error('Failed to update preview:', err));
      } else if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'update-preview',
          html: htmlContent,
          css: cssContent,
          js: jsContent
        }, '*');
      }
    }
  }, [htmlContent, cssContent, jsContent]);

  // Open DevTools for the webview in Electron (development only)
  useEffect(() => {
    if (isElectron && webviewRef.current) {
      const webview = webviewRef.current;
      const handleDomReady = () => {
        if (webview && webview.openDevTools) {
          console.log('Opening DevTools for preview webview');
          // Add the preload script to the webview when DOM is ready
          webview.executeJavaScript(preloadScript)
            .then(() => {
              console.log('Preload script injected successfully');
              // Update preview content after preload script is injected
              updatePreview();
            })
            .catch((err: Error) => console.error('Failed to inject preload script:', err));
          // Don't auto-open DevTools anymore, let user click the button
          // webview.openDevTools();
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
  }, [updatePreview]);

  // Update preview when content changes
  useEffect(() => {
    if (htmlContent && cssContent && jsContent) {
      // Handle iframe case
      if (!isElectron && iframeRef.current) {
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
      } else if (webviewRef.current && webviewRef.current.isReady) {
        updatePreview();
      }
    }
  }, [htmlContent, cssContent, jsContent, updatePreview]);

  const handleOpenDevTools = () => {
    if (isElectron && webviewRef.current && webviewRef.current.openDevTools) {
      webviewRef.current.openDevTools();
    }
  };

  if (elements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500 dark:text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <LayoutGrid className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
          Your UI canvas is empty
        </h3>
        <p className="text-sm max-w-md">
          Use the component panel on the left to add elements, or ask the AI to create components for you.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full relative">
      <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        {previewError && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-2 text-sm">
            Error on line {previewError.line}: {previewError.message}
          </div>
        )}
        <div className="bg-gray-50 dark:bg-gray-900 rounded border border-dashed border-gray-300 dark:border-gray-700 min-h-[300px] p-0 h-full w-full overflow-hidden">
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
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
              title="Preview"
            />
          )}
        </div>
      </div>
      
      {/* Floating DevTools Button - only shown in Electron mode */}
      {isElectron && (
        <div 
          className="absolute bottom-10 right-10 z-10"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button 
            onClick={handleOpenDevTools}
            className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 animate-pulse hover:animate-none"
            aria-label="Open Developer Tools"
          >
            <Terminal size={20} />
          </button>
          
          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute -top-10 right-0 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap">
              Open DevTools
              <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-800 rotate-45"></div>
            </div>
          )}
        </div>
      )}
      
      {/* Update Preview Button - only shown if we have content */}
      {htmlContent && cssContent && jsContent && (
        <div className="absolute bottom-10 left-10 z-10">
          <button 
            onClick={updatePreview}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
            aria-label="Refresh Preview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default PreviewPanel; 