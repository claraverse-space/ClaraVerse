import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Store from './n8n_components/Store';
import MiniStore from './n8n_components/MiniStore';
import N8NStartupModal from './N8NStartupModal';
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

    // Refresh configuration every 60 seconds (reduced from 30s to minimize API calls)
    const interval = setInterval(loadServiceConfig, 60000);
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

  // N8N startup modal state
  const [showStartupModal, setShowStartupModal] = useState(false);
  const [n8nServiceRunning, setN8nServiceRunning] = useState<boolean | null>(null);

  // Check N8N service status on component mount and when service config changes
  useEffect(() => {
    const checkN8NStatus = async () => {
      if (serviceConfigLoading || !n8nUrl) return;
      
      try {
        const result = await (window as any).electronAPI.invoke('n8n:check-service-status');
        setN8nServiceRunning(result.running);
        
        // Show modal if service is not running
        // For docker mode: show startup modal
        // For manual mode: show connection error modal
        if (!result.running) {
          setShowStartupModal(true);
        }
      } catch (error) {
        console.error('Failed to check N8N service status:', error);
        setN8nServiceRunning(false);
        
        // Show modal if we can't determine status (likely not running)
        setShowStartupModal(true);
      }
    };

    checkN8NStatus();
  }, [serviceConfigLoading, n8nUrl, n8nMode]);

  const handleStartupModalSuccess = (serviceUrl: string) => {
    setN8nServiceRunning(true);
    setShowStartupModal(false);
    
    // Refresh the webview with the new service URL
    if (webviewRef.current) {
      webviewRef.current.src = serviceUrl;
    }
  };

  const handleStartupModalClose = () => {
    setShowStartupModal(false);
  };

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

  const handleRefresh = async () => {
    // First check service status
    try {
      const result = await (window as any).electronAPI.invoke('n8n:check-service-status');
      setN8nServiceRunning(result.running);
      
      if (!result.running) {
        setShowStartupModal(true);
        return;
      }
    } catch (error) {
      console.error('Failed to check N8N service status:', error);
      setN8nServiceRunning(false);
      setShowStartupModal(true);
      return;
    }

    // If service is running, refresh the webview
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
    const handleDidFailLoad = async (event: Event) => {
      const failEvent = event as any;
      // Ignore -3 error code which is a normal cancellation
      if (failEvent.errorCode !== -3) {
        // Check if this is a connection failure (could be docker or manual mode)
        if (failEvent.errorCode === -102 || failEvent.errorCode === -105) {
          // Connection refused or name not resolved - likely service not running
          try {
            const result = await (window as any).electronAPI.invoke('n8n:check-service-status');
            if (!result.running) {
              setShowStartupModal(true);
              setError(null); // Clear error since we'll show modal instead
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('Failed to check service status after connection failure:', error);
            // Show modal anyway as fallback
            setShowStartupModal(true);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
        
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
    if (!webhookUrl) {
      setTestResult("❌ Please enter a webhook URL");
      setTimeout(() => setTestResult(null), 5000);
      return;
    }

    setIsTestingWebhook(true);
    setWebhookResponse(null);

    try {
      let requestBody = undefined;
      
      // Prepare request body for non-GET methods
      if (webhookMethod !== 'GET') {
        if (webhookBody.trim()) {
          try {
            requestBody = JSON.stringify(JSON.parse(webhookBody));
          } catch (e) {
            // If it's not valid JSON, send as plain text
            requestBody = webhookBody;
          }
        } else {
          // Default test payload
          requestBody = JSON.stringify({
            message: 'Test webhook from ClaraVerse',
            timestamp: new Date().toISOString(),
          });
        }
      }

      const response = await fetch(webhookUrl, {
        method: webhookMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const responseText = await response.text();
      
      if (response.ok) {
        setTestResult('✅ Webhook test successful!');
        setWebhookResponse(responseText);
      } else {
        setTestResult(`❌ Webhook test failed: ${response.status} ${response.statusText}`);
        setWebhookResponse(`Error: ${response.status} ${response.statusText}\n\n${responseText}`);
      }
    } catch (error) {
      setTestResult(`❌ Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setWebhookResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingWebhook(false);
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
    const currentStep = !webhookUrl ? 1 : !testResult && !webhookResponse ? 2 : 3;
    
    return (
      <div className="w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Webhook className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Webhook Tool Studio
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Test webhooks & create AI tools
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowWebhookTester(false);
                setShowCreateTool(false);
                setWebhookUrl('');
                setWebhookResponse(null);
                setTestResult(null);
              }}
              className="p-2 rounded-lg hover:bg-white/80 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  step <= currentStep 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 3 && (
                  <div className={`flex-1 h-1 rounded-full transition-all ${
                    step < currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {/* Step 1: Configure Webhook */}
          <div className={`space-y-6 ${currentStep !== 1 && webhookResponse ? 'opacity-75' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${currentStep === 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <h4 className="font-medium text-gray-900 dark:text-white">Configure Webhook</h4>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white transition-all pl-10"
                    placeholder="https://api.example.com/webhook"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Method
                  </label>
                  <select
                    value={webhookMethod}
                    onChange={(e) => setWebhookMethod(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={handleTestWebhook}
                    disabled={!webhookUrl || isTestingWebhook}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg shadow-sm disabled:cursor-not-allowed transition-colors"
                  >
                    {isTestingWebhook ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Test
                      </>
                    )}
                  </button>
                </div>
              </div>

              {webhookMethod !== 'GET' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Request Body (JSON)
                  </label>
                  <textarea
                    value={webhookBody}
                    onChange={(e) => setWebhookBody(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white font-mono text-sm"
                    placeholder='{\n  "message": "Hello World",\n  "data": {}\n}'
                  />
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Test Results */}
          {(testResult || webhookResponse) && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${currentStep === 2 ? 'bg-blue-600' : 'bg-green-500'}`} />
                <h4 className="font-medium text-gray-900 dark:text-white">Test Results</h4>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg border-l-4 ${
                  testResult.includes('✅') 
                    ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-400' 
                    : 'bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-400'
                }`}>
                  <div className="flex items-center gap-2">
                    {testResult.includes('✅') ? (
                      <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                    <span className={`text-sm font-medium ${
                      testResult.includes('✅') 
                        ? 'text-green-800 dark:text-green-200' 
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {testResult}
                    </span>
                  </div>
                </div>
              )}

              {webhookResponse && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Response Data
                  </label>
                  <div className="relative">
                    <pre className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto text-sm font-mono max-h-48">
                      {webhookResponse}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(webhookResponse)}
                      className="absolute top-3 right-3 p-1.5 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="Copy response"
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Create Tool */}
          {webhookResponse && testResult?.includes('✅') && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${showCreateTool ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <h4 className="font-medium text-gray-900 dark:text-white">Create AI Tool</h4>
              </div>

              {!showCreateTool ? (
                <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="text-center space-y-3">
                    <div className="mx-auto w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <h5 className="font-medium text-gray-900 dark:text-white">Turn into AI Tool</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                      Transform this working webhook into a Clara Assistant tool that can be used in conversations.
                    </p>
                    <button
                      onClick={() => setShowCreateTool(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                      <Wrench className="w-4 h-4" />
                      Create Tool
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tool Name *
                    </label>
                    <input
                      type="text"
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="my_awesome_tool"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Lowercase letters, numbers, and underscores only
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={toolDescription}
                      onChange={(e) => setToolDescription(e.target.value)}
                      rows={3}
                      placeholder="This helpful tool allows Clara to..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Describe what this tool does for Clara
                    </p>
                  </div>

                  {toolCreationError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm text-red-700 dark:text-red-300">{toolCreationError}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleCreateTool}
                      disabled={!toolName || !toolDescription}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 rounded-lg shadow-sm disabled:cursor-not-allowed transition-all"
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
                      className="px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Webhook Studio</span>
            <button
              onClick={() => {
                setWebhookUrl('');
                setWebhookResponse(null);
                setTestResult(null);
                setShowCreateTool(false);
                setToolName('');
                setToolDescription('');
              }}
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Reset All
            </button>
          </div>
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

      {/* N8N Startup Modal */}
      <N8NStartupModal
        isOpen={showStartupModal}
        onClose={handleStartupModalClose}
        onSuccess={handleStartupModalSuccess}
        n8nMode={n8nMode}
        n8nUrl={n8nUrl}
      />
    </div>
  );
};

export default N8N; 