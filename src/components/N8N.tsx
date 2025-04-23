import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ExternalLink, AlertCircle, RefreshCcw, Terminal, XCircle } from 'lucide-react';
import type { ElectronAPI, SetupStatus } from '../types/electron';
import type { WebviewTag } from 'electron';

// --- Consolidated Type Definitions ---

// Define the expected structure for service ports
interface ServicePorts {
  python: number;
  n8n: number;
  ollama: number;
}

declare global {
  // Declare window.electron once with the correct type
  interface Window {
    electron: ElectronAPI;
  }
  
  // Define Electron Webview HTML Attributes correctly
  interface WebViewHTMLAttributes<T> extends React.HTMLAttributes<T> {
    src?: string;
    allowpopups?: string; // Note: HTML standard is allowPopups (camelCase), but Electron might use lowercase
    // Add other webview specific attributes if needed
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement>;
    }
  }

  // Define Electron DidFailLoadEvent type (simplified)
  interface DidFailLoadEvent {
    errorCode: number;
    errorDescription: string;
    // other properties might exist
  }
}
// --- End of Type Definitions ---

interface N8NProps {
  onPageChange?: (page: string) => void;
}

const N8N: React.FC<N8NProps> = ({ onPageChange }) => {
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [n8nPort, setN8nPort] = useState<number | null>(null);
  const [ports, setPorts] = useState<ServicePorts | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const webviewRef = useRef<WebviewTag | null>(null);

  useEffect(() => {
    const fetchPorts = async () => {
      try {
        if (!window.electron?.getServicePorts) {
          throw new Error('Electron API not available');
        }
        const ports = await window.electron.getServicePorts();
        setN8nPort(ports.n8n);
        setPorts(ports);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get service ports';
        setError(errorMessage);
        console.error(err);
      }
    };
    fetchPorts();

    let cleanup: (() => void) | null = null;
    if (window.electron?.ipcRenderer) {
      cleanup = window.electron.ipcRenderer.on('setup-status', (status) => {
        if (typeof status === 'object' && status !== null) {
          const { type = 'info', message } = status as SetupStatus;
          setTerminalOutput(prev => [...prev, `${type}: ${message}`]);
          setSetupStatus(status as SetupStatus);
        } else if (typeof status === 'string') {
          setTerminalOutput(prev => [...prev, `info: ${status}`]);
        }
      });
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const handleRefresh = () => {
    if (webviewRef.current) {
      try {
        webviewRef.current.reload();
      } catch (e) {
        console.error("Error reloading webview:", e);
        setError("Could not reload n8n view.");
      }
    }
  };

  const handleOpenExternal = () => {
    if (n8nPort) {
      window.open(`http://localhost:${n8nPort}`, '_blank');
    } else {
      setError("Cannot open n8n externally: Port not determined.");
    }
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || n8nPort === null) {
      return;
    }

    const handleLoadStart = () => setIsLoading(true);
    const handleLoadStop = () => setIsLoading(false);
    const handleDidFailLoad = (event: Event) => {
      const failEvent = event as any;
      if (failEvent.errorCode !== -3) {
        setError(`Failed to load n8n view: ${failEvent.errorDescription} (Code: ${failEvent.errorCode})`);
        setIsLoading(false);
      }
    };

    webview.addEventListener('did-start-loading', handleLoadStart);
    webview.addEventListener('did-stop-loading', handleLoadStop);
    webview.addEventListener('did-fail-load', handleDidFailLoad);

    webview.src = `http://localhost:${n8nPort}`;

    return () => {
      webview.removeEventListener('did-start-loading', handleLoadStart);
      webview.removeEventListener('did-stop-loading', handleLoadStop);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
    };
  }, [n8nPort]);

  return (
    <div className="flex h-screen">
      <Sidebar activePage="n8n" onPageChange={onPageChange || (() => {})} />
      
      <div className="flex-1 flex flex-col">
        <Topbar onPageChange={onPageChange || (() => {})} />
        
        <main className="flex-1 p-6 overflow-auto bg-gray-50 dark:bg-gray-900">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">X</button>
            </div>
          )}

          <div className="h-full flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            {/* Header/Toolbar */}
            <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading || !n8nPort}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh n8n View"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowTerminal(!showTerminal)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  title="Toggle Setup Logs"
                >
                  <Terminal className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                 {n8nPort ? <span className="text-xs text-gray-500 dark:text-gray-400">n8n Port: {n8nPort}</span> : <span className="text-xs text-yellow-500">Fetching port...</span>}
                 <button
                   onClick={handleOpenExternal}
                   disabled={!n8nPort}
                   className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                   title="Open n8n in Browser"
                 >
                   <ExternalLink className="w-4 h-4" />
                 </button>
              </div>
            </div>

            {/* Webview and Terminal Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`flex-1 ${showTerminal ? 'h-2/3' : 'h-full'} transition-height duration-300 ease-in-out`}>
                {n8nPort !== null ? (
                  <webview
                    ref={webviewRef}
                    className="w-full h-full border-none"
                    allowpopups={true}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {isLoading ? 'Loading...' : 'Determining n8n port...'}
                  </div>
                )}
              </div>
              {showTerminal && (
                <div className="h-1/3 border-t border-gray-200 dark:border-gray-700 bg-gray-900 text-gray-200 font-mono text-xs overflow-y-auto p-3 flex flex-col-reverse">
                   <div style={{ maxHeight: 'calc(100% - 30px)', overflowY: 'auto' }} >
                     {terminalOutput.map((line, index) => (
                       <div key={index} className={`${line.startsWith('error:') ? 'text-red-400' : line.startsWith('warning:') ? 'text-yellow-400' : 'text-gray-300'} whitespace-pre-wrap`}>{line}</div>
                     ))}
                     <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                   </div>
                   <div className="flex justify-between items-center mb-2 sticky top-0 bg-gray-900 py-1">
                     <span className="font-semibold">Setup Logs</span>
                     <button onClick={() => setTerminalOutput([])} className="text-xs hover:text-red-400">Clear</button>
                   </div>
                 </div>
               )}
             </div>
           </div>
         </main>
       </div>
     </div>
   );
 };

 export default N8N; 