import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ExternalLink, AlertCircle, RefreshCcw, Terminal, XCircle } from 'lucide-react';

declare global {
  interface Window {
    electron: {
      checkN8NHealth: () => Promise<{ success: boolean; data?: any; error?: string }>;
      startN8N: () => Promise<{ success: boolean; pid?: number; error?: string }>;
      stopN8N: () => Promise<{ success: boolean; error?: string }>;
      receive: (channel: string, callback: (data: any) => void) => void;
      removeListener: (channel: string) => void;
    };
  }
}

// Add Electron WebviewTag type
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement>;
    }
  }
}

interface N8NProps {
  onPageChange?: (page: string) => void;
}

const N8N: React.FC<N8NProps> = ({ onPageChange }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const webviewRef = useRef<HTMLWebViewElement | null>(null);
  const maxRetries = 30;
  const retryInterval = 2000; // 2 seconds

  useEffect(() => {
    checkEnvironment();
    
    // Listen for N8N output
    window.electron.receive('n8n-output', (data) => {
      setTerminalOutput(prev => [...prev, `${data.type}: ${data.data}`]);
    });
    
    // Listen for N8N errors
    window.electron.receive('n8n-error', (error) => {
      setError(error);
      setTerminalOutput(prev => [...prev, `Error: ${error}`]);
    });

    return () => {
      window.electron.removeListener('n8n-output');
      window.electron.removeListener('n8n-error');
    };
  }, []);

  // Add retry mechanism
  useEffect(() => {
    let retryTimer: NodeJS.Timeout;
    
    if (isStarting && retryCount < maxRetries) {
      retryTimer = setInterval(async () => {
        const healthCheck = await window.electron.checkN8NHealth();
        if (healthCheck.success) {
          setIsRunning(true);
          setIsStarting(false);
          setRetryCount(0);
          if (webviewRef.current) {
            (webviewRef.current as any).reload();
          }
        } else {
          setRetryCount(prev => prev + 1);
        }
      }, retryInterval);
    }

    return () => {
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [isStarting, retryCount]);

  const checkEnvironment = async () => {
    try {
      setIsLoading(true);
      
      // Check if N8N is running
      const healthCheck = await window.electron.checkN8NHealth();
      setIsRunning(healthCheck.success);
      
      if (healthCheck.success) {
        setTerminalOutput(prev => [...prev, 'N8N is running and healthy']);
      } else {
        setTerminalOutput(prev => [...prev, 'N8N is not running']);
      }
    } catch (err) {
      setError('Failed to check N8N status.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartN8N = async () => {
    try {
      setIsStarting(true);
      setRetryCount(0);
      setTerminalOutput(prev => [...prev, 'Starting N8N...']);
      const result = await window.electron.startN8N();
      
      if (result.success) {
        setTerminalOutput(prev => [...prev, `N8N started successfully with PID: ${result.pid}`]);
      } else {
        setIsStarting(false);
        setError(result.error || 'Failed to start N8N');
        setTerminalOutput(prev => [...prev, `Failed to start N8N: ${result.error}`]);
      }
    } catch (err) {
      setIsStarting(false);
      setError('Error starting N8N');
      setTerminalOutput(prev => [...prev, `Error starting N8N: ${err}`]);
    }
  };

  const handleStopN8N = async () => {
    try {
      setTerminalOutput(prev => [...prev, 'Stopping N8N...']);
      const result = await window.electron.stopN8N();
      
      if (result.success) {
        setIsRunning(false);
        setTerminalOutput(prev => [...prev, 'N8N stopped successfully']);
      } else {
        setError(result.error || 'Failed to stop N8N');
        setTerminalOutput(prev => [...prev, `Failed to stop N8N: ${result.error}`]);
      }
    } catch (err) {
      setError('Error stopping N8N');
      setTerminalOutput(prev => [...prev, `Error stopping N8N: ${err}`]);
    }
  };

  const handleRefresh = () => {
    if (webviewRef.current) {
      (webviewRef.current as any).reload();
    }
  };

  const handleOpenExternal = () => {
    window.open('http://localhost:5678', '_blank');
  };

  return (
    <div className="flex h-screen">
      <Sidebar activePage="n8n" onPageChange={onPageChange || (() => {})} />
      
      <div className="flex-1 flex flex-col">
        <Topbar onPageChange={onPageChange || (() => {})} />
        
        <main className="flex-1 p-6 overflow-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  title="Refresh"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowTerminal(!showTerminal)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  title="Toggle Terminal"
                >
                  <Terminal className="w-4 h-4" />
                </button>
                <button
                  onClick={isRunning ? handleStopN8N : handleStartN8N}
                  disabled={isStarting}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    isRunning
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  } ${isStarting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isStarting ? 'Starting...' : (isRunning ? 'Stop N8N' : 'Start N8N')}
                </button>
                {isStarting && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span>Waiting for N8N to start... ({retryCount}/{maxRetries})</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Browser
              </button>
            </div>
            
            {isRunning ? (
              <webview
                ref={webviewRef}
                src="http://localhost:5678"
                className="flex-1 w-full h-full"
                allowpopups={true}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    N8N is not running. Click 'Start N8N' to begin.
                  </p>
                  {isStarting && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                      <p className="text-sm text-gray-500">
                        Starting N8N... ({retryCount}/{maxRetries} retries)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Terminal Sidebar */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-96 bg-gray-900 text-white transform transition-transform duration-300 ${
              showTerminal ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between p-2 border-b border-gray-700">
              <h3 className="text-sm font-semibold">Terminal Output</h3>
              <button
                onClick={() => setShowTerminal(false)}
                className="p-1 hover:text-gray-300"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 font-mono text-sm h-full overflow-y-auto">
              {terminalOutput.map((line, index) => (
                <div key={index} className="mb-1">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default N8N; 