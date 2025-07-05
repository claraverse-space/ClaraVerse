import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Store from './n8n_components/Store';
import MiniStore from './n8n_components/MiniStore';
import { Plus, Trash2, Check, X,  AlertCircle,  ExternalLink, RefreshCcw, Terminal, Send, Webhook, Wrench, Settings2, Store as StoreIcon, WifiOff } from 'lucide-react';
import type { ElectronAPI, SetupStatus } from '../types/electron';
import type { WebviewTag } from 'electron';
import { db } from '../db';
import { prefetchAndStoreWorkflows } from './n8n_components/utils/workflowsDB';

// Define the expected structure for service ports
interface ServicePorts {
  python: number;
  n8n: number;
  ollama: number;
}

// Custom hook to get N8N service configuration
const useN8NServiceConfig = () => {
  const [n8nUrl, setN8nUrl] = useState<string>('http://localhost:5678');
  const [n8nMode, setN8nMode] = useState<string>('docker');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServiceConfig = async () => {
      try {
        console.log('🔍 Loading N8N service configuration...');
        
        // Check if electronAPI is available
        if (!(window as any).electronAPI) {
          console.error('❌ electronAPI not available');
          return;
        }
        
        // Get service configurations and status
        console.log('📡 Calling service-config:get-all-configs...');
        const configs = await (window as any).electronAPI.invoke('service-config:get-all-configs');
        console.log('📡 Calling service-config:get-enhanced-status...');
        const status = await (window as any).electronAPI.invoke('service-config:get-enhanced-status');
        
        console.log('✅ Service API calls completed');

        const n8nConfig = configs?.n8n || { mode: 'docker', url: null };
        const n8nStatus = status?.n8n || {};

        // Set the mode from the actual deployment mode in status, fallback to config mode
        const actualMode = n8nStatus.deploymentMode || n8nConfig.mode || 'docker';
        setN8nMode(actualMode);

        let finalUrl = 'http://localhost:5678'; // Default fallback

        if (n8nConfig.url) {
          // Use configured URL
          finalUrl = n8nConfig.url;
        } else if (n8nStatus.serviceUrl) {
          // Use auto-detected URL from service status
          finalUrl = n8nStatus.serviceUrl;
        }

        console.log('🔗 N8N Service Config DEBUG:', {
          configs: configs,
          status: status,
          n8nConfig: n8nConfig,
          n8nStatus: n8nStatus,
          configMode: n8nConfig.mode,
          deploymentMode: n8nStatus.deploymentMode,
          actualMode: actualMode,
          configUrl: n8nConfig.url,
          statusUrl: n8nStatus.serviceUrl,
          finalUrl
        });

        setN8nUrl(finalUrl);
      } catch (error) {
        console.error('Failed to load N8N service config:', error);
        // Keep default URL and mode
      } finally {
        setLoading(false);
      }
    };

    loadServiceConfig();

    // Refresh configuration every 30 seconds
    const interval = setInterval(loadServiceConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  return { n8nUrl, n8nMode, loading };
};

declare global {
  interface WebViewHTMLAttributes<T> extends React.HTMLAttributes<T> {
    src?: string;
    allowpopups?: string; 
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement>;
    }
  }

  interface DidFailLoadEvent {
    errorCode: number;
    errorDescription: string;
  }
}

interface N8NProps {
  onPageChange?: (page: string) => void;
}

const N8N: React.FC<N8NProps> = ({ onPageChange }) => {
  // Use N8N service configuration
  const { n8nUrl, n8nMode, loading: serviceConfigLoading } = useN8NServiceConfig();
  
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const webviewRef = useRef<WebviewTag | null>(null);
  const [showWebhookTester, setShowWebhookTester] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMethod, setWebhookMethod] = useState('GET');
  const [webhookBody, setWebhookBody] = useState('');
  const [webhookResponse, setWebhookResponse] = useState<string | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [showCreateTool, setShowCreateTool] = useState(false);
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [toolCreationError, setToolCreationError] = useState<string | null>(null);
  const [showToolsList, setShowToolsList] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [showStore, setShowStore] = useState(false);
  const [showNewFeatureTag, setShowNewFeatureTag] = useState(false);
  const [showMiniStore, setShowMiniStore] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Wallpaper state
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  useEffect(() => {
    const loadWallpaper = async () => {
      try {
        const wallpaper = await db.getWallpaper();
        if (wallpaper) {
          setWallpaperUrl(wallpaper);
        }
      } catch (error) {
        console.error('Error loading wallpaper:', error);
      }
    };
    loadWallpaper();
  }, []);

  useEffect(() => {
    const prefetchWorkflows = async () => {
      try {
        console.log('Starting initial workflow prefetch');
        const data = await prefetchAndStoreWorkflows();
        console.log(`Successfully prefetched ${data?.length || 0} workflows`);
      } catch (error) {
        console.error('Failed to prefetch workflows:', error);
        setError(`Failed to fetch workflows. Offline mode may be used: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => {
          setError(null);
        }, 5000);
      }
    };

    prefetchWorkflows();
  }, []); // Run once when component mounts

  // Add effect to load tools when tools list is opened
  useEffect(() => {
    if (showToolsList) {
      loadTools();
    }
  }, [showToolsList]);

  useEffect(() => {
    // Setup terminal output listener
    let cleanup: (() => void) | null = null;
    if ((window as any).electronAPI?.ipcRenderer) {
      cleanup = (window as any).electronAPI.ipcRenderer.on('setup-status', (status: any) => {
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

  useEffect(() => {
    const hasSeenFeature = localStorage.getItem('hasSeenWorkflowVerse');
    if (!hasSeenFeature) {
      setShowNewFeatureTag(true);
    }
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
    if (n8nUrl) {
      window.open(n8nUrl, '_blank');
    } else {
      setError("Cannot open n8n externally: URL not determined.");
    }
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !n8nUrl || serviceConfigLoading) {
      return;
    }

    const handleLoadStart = () => setIsLoading(true);
    const handleLoadStop = () => setIsLoading(false);
    const handleDidFailLoad = (event: Event) => {
      const failEvent = event as any;
      // Ignore -3 error code which is a normal cancellation
      if (failEvent.errorCode !== -3) {
        setError(`Failed to load n8n view: ${failEvent.errorDescription} (Code: ${failEvent.errorCode})`);
        setIsLoading(false);
        
        // Add retry logic with increasing delay
        setTimeout(() => {
          if (webview) {
            console.log('Retrying n8n connection...');
            webview.reload();
          }
        }, 5000); // Retry after 5 seconds
      }
    };

    const handleDomReady = () => {
      // Clear any existing error when the page loads successfully
      setError(null);
      setIsLoading(false);
      
      // Inject Google Fonts link for Quicksand
      webview.executeJavaScript(`
        if (!document.getElementById('quicksand-font')) {
          const link = document.createElement('link');
          link.id = 'quicksand-font';
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap';
          document.head.appendChild(link);
        }
      `);
      // Inject CSS to use Quicksand
      webview.insertCSS(`
        body, #app, * {
          font-family: 'Quicksand', sans-serif !important;
        }
        body { overflow: auto !important; }
        #app { height: 100vh !important; }
      `);
    };

    webview.addEventListener('did-start-loading', handleLoadStart);
    webview.addEventListener('did-stop-loading', handleLoadStop);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('dom-ready', handleDomReady);

    // Set URL from service configuration
    console.log('Setting n8n URL from service config:', n8nUrl);
    webview.src = n8nUrl;

    return () => {
      webview.removeEventListener('did-start-loading', handleLoadStart);
      webview.removeEventListener('did-stop-loading', handleLoadStop);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('dom-ready', handleDomReady);
    };
  }, [n8nUrl, serviceConfigLoading]);

  const handleTestWebhook = async () => {
    if (!n8nUrl) {
      setError("Cannot test webhook: n8n URL not available");
      return;
    }

    try {
      const response = await fetch(`${n8nUrl}/webhook-test/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Test webhook from ClaraVerse',
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setTestResult('✅ Webhook test successful!');
      } else {
        setTestResult(`❌ Webhook test failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setTestResult(`❌ Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setTimeout(() => setTestResult(null), 5000);
  };

  const handleCreateTool = async () => {
    setToolCreationError(null);
    
    // Validate tool name (only underscores, no spaces)
    if (!/^[a-z0-9_]+$/.test(toolName)) {
      setToolCreationError('Tool name can only contain lowercase letters, numbers, and underscores');
      return;
    }

    try {
      const toolDefinition = {
        name: toolName,
        description: toolDescription,
        parameters: [
          {
            name: "input",
            type: "string",
            description: "The input to send to the webhook",
            required: true
          }
        ],
        implementation: `async function implementation(args) {
  try {
    const response = await fetch("${webhookUrl}", {
      method: "${webhookMethod}",
      headers: {
        "Content-Type": "application/json"
      },
      body: ${webhookMethod !== 'GET' ? 'args.input' : 'undefined'}
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(\`Webhook call failed: \${error.message}\`);
  }
}`,
        isEnabled: true
      };

      await db.addTool(toolDefinition);
      setShowCreateTool(false);
      setToolName('');
      setToolDescription('');
      setToolCreationError(null);
    } catch (err) {
      setToolCreationError(err instanceof Error ? err.message : 'Failed to create tool');
    }
  };

  const loadTools = async () => {
    try {
      const toolsList = await db.getAllTools();
      setTools(toolsList);
    } catch (err) {
      console.error('Failed to load tools:', err);
      setError('Failed to load tools');
    }
  };

  const handleStoreClick = () => {
    setShowStore(true);
    if (showNewFeatureTag) {
      localStorage.setItem('hasSeenWorkflowVerse', 'true');
      setShowNewFeatureTag(false);
    }
  };

  const renderWebhookTester = () => {
    return (
      <div className="w-80 border-l border-transparent dark:border-gray-800 bg-white dark:bg-black overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Webhook Tester
            </h3>
            <button
              onClick={() => setShowWebhookTester(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Webhook URL
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:text-white"
              placeholder="Enter webhook URL"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Method
            </label>
            <select
              value={webhookMethod}
              onChange={(e) => setWebhookMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:text-white"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          {webhookMethod !== 'GET' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Request Body (JSON)
              </label>
              <textarea
                value={webhookBody}
                onChange={(e) => setWebhookBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:text-white font-mono text-sm"
                placeholder="{}"
              />
            </div>
          )}

          <button
            onClick={handleTestWebhook}
            disabled={!webhookUrl || isTestingWebhook}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingWebhook ? (
              <>
                <RefreshCcw className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Test Webhook
              </>
            )}
          </button>

          {testResult && (
            <div className="text-center text-lg font-semibold text-green-500 dark:text-green-400">
              {testResult}
            </div>
          )}

          {webhookResponse && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Response
                </label>
                <pre className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-x-auto text-sm font-mono">
                  {webhookResponse}
                </pre>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setShowCreateTool(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sakura-500 hover:bg-sakura-600 rounded-md"
                >
                  <Wrench className="w-4 h-4" />
                  Create Clara Assistant Tool
                </button>
              </div>

              {showCreateTool && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tool Name (lowercase, underscores only)
                    </label>
                    <input
                      type="text"
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value.toLowerCase())}
                      placeholder="my_webhook_tool"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (be friendly!)
                    </label>
                    <textarea
                      value={toolDescription}
                      onChange={(e) => setToolDescription(e.target.value)}
                      rows={3}
                      placeholder="This friendly tool helps you..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  {toolCreationError && (
                    <div className="text-sm text-red-500">
                      {toolCreationError}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateTool}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                    >
                      <Plus className="w-4 h-4" />
                      Create Tool
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateTool(false);
                        setToolName('');
                        setToolDescription('');
                        setToolCreationError(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderToolsList = () => {
    return (
      <div className="w-80 border-l border-transparent dark:border-gray-800 bg-white dark:bg-black overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Clara Tools
            </h3>
            <button
              onClick={() => setShowToolsList(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {tools.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No tools found
            </div>
          ) : (
            <div className="space-y-3">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {tool.name}
                      </h4>
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          tool.isEnabled 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {tool.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          onClick={() => {
                            db.updateTool(tool.id, { ...tool, isEnabled: !tool.isEnabled }).then(loadTools);
                          }}
                          className={`p-1.5 rounded-lg ${tool.isEnabled ? 'text-green-500 hover:text-green-600' : 'text-red-500 hover:text-red-600'}`}
                          title={tool.isEnabled ? 'Tool is enabled - Click to disable' : 'Tool is disabled - Click to enable'}
                        >
                          {tool.isEnabled ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <X className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this tool?')) {
                              db.deleteTool(tool.id).then(loadTools);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500"
                          title="Delete tool"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {tool.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex h-screen">
      {/* Wallpaper */}
      {wallpaperUrl && (
        <div 
          className="absolute top-0 left-0 right-0 bottom-0 z-0"
          style={{
            backgroundImage: `url(${wallpaperUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
            filter: 'blur(1px)',
            pointerEvents: 'none'
          }}
        />
      )}
      <Sidebar activePage="n8n" onPageChange={onPageChange || (() => {})} />
      
      <div className="flex-1 flex flex-col">
        <Topbar onPageChange={onPageChange || (() => {})} />
        
        <main className="flex-1 p-6 overflow-auto bg-gray-50 dark:bg-black">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">X</button>
            </div>
          )}

          <div className="h-full flex overflow-hidden">
            <div className={`flex-1 flex flex-col ${showStore ? 'hidden' : ''}`}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-black">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={isLoading || !n8nUrl}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                    title="Refresh n8n View"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowTerminal(!showTerminal)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 group relative"
                  >
                    <Terminal className="w-4 h-4" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                      Setup Logs
                    </div>
                  </button>
                </div>
                <div className="flex-1 flex justify-center items-center">
                  <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 via-blue-500 to-pink-500 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-200"></div>
                    <button
                      onClick={handleStoreClick}
                      className="relative flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-black rounded-full group"
                      title="Open ClaraVerse Store"
                    >
                      <StoreIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">ClaraVerse Store</span>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                        Browse all workflows and integrations
                      </div>
                    </button>
                    {showNewFeatureTag && (
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap">
                        <div className="bg-gradient-to-r from-purple-600 via-blue-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-1">
                          New Feature - Explore ClaraVerse Store!
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {n8nUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">n8n URL: {n8nUrl}</span>
                      {n8nMode && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                          {n8nMode}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-yellow-500">Fetching URL...</span>
                  )}
                  <button
                    onClick={handleOpenExternal}
                    disabled={!n8nUrl}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                      Open in Browser
                    </div>
                  </button>
                  <button
                    onClick={() => setShowWebhookTester(!showWebhookTester)}
                    className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 ${showWebhookTester ? 'bg-gray-100 dark:bg-gray-900' : ''} group relative`}
                  >
                    <Webhook className="w-4 h-4" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                      Webhook Tester
                    </div>
                  </button>
                  <button
                    onClick={() => setShowMiniStore(!showMiniStore)}
                    className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 ${showMiniStore ? 'bg-gray-100 dark:bg-gray-900' : ''} group relative`}
                  >
                    <StoreIcon className="w-4 h-4" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                      Quick Workflows 
                    </div>
                  </button>
                  <button
                    onClick={() => setShowToolsList(!showToolsList)}
                    className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 ${showToolsList ? 'bg-gray-100 dark:bg-gray-900' : ''} group relative`}
                  >
                    <Settings2 className="w-4 h-4" />
                    <div className="absolute right-full right-1/2  -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                      Clara's Tool Belt
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className={`flex-1 ${showTerminal ? 'h-2/3' : 'h-full'} transition-height duration-300 ease-in-out`}>
                  {n8nUrl ? (
                    <webview
                      ref={webviewRef}
                      className="w-full h-full border-none"
                      allowpopups={true}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      {isLoading ? 'Loading...' : 'Determining n8n URL...'}
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

            {showStore && <Store onBack={() => setShowStore(false)} />}
            
            {!showStore && showWebhookTester && renderWebhookTester()}

            {!showStore && showMiniStore && (
              <MiniStore onClose={() => setShowMiniStore(false)} />
            )}

            {!showStore && showToolsList && renderToolsList()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default N8N; 