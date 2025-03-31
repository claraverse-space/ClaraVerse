import React, { useState, useEffect } from 'react';
import { 
  Bot,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ImageIcon,
  MessageSquare,
  Lightbulb,
  Code,
  FileText,
  Zap,
  Info,
  Star,
  RefreshCw,
  Sparkles,
  Server
} from 'lucide-react';
import { db } from '../db';
import axios from 'axios';
import api from '../services/api'; // Import the API service

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showOllamaUrlInput, setShowOllamaUrlInput] = useState(false);
  const [pythonStatus, setPythonStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [pythonPort, setPythonPort] = useState<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await db.getAPIConfig();
      
      if (config?.ollama_base_url) {
        setOllamaUrl(config.ollama_base_url);
        checkOllamaConnection(config.ollama_base_url);
      } else {
        setOllamaStatus('disconnected');
      }
      
      // Get Python port from Electron
      if (window.electron) {
        try {
          const port = await window.electron.getPythonPort();
          setPythonPort(port);
          console.log('Python port from Electron:', port);
        } catch (error) {
          console.error('Could not get Python port from Electron:', error);
        }
      }
      
      // Use the new checkPythonBackend method
      if (window.electron) {
        try {
          const backendStatus = await window.electron.checkPythonBackend();
          console.log('Python backend status:', backendStatus);
          
          if (backendStatus.port) {
            setPythonPort(backendStatus.port);
          }
          
          if (backendStatus.status === 'running' && backendStatus.available) {
            setPythonStatus('connected');
          } else {
            // Try the API service as a fallback
            checkPythonConnection();
          }
        } catch (error) {
          console.error('Error checking Python backend:', error);
          checkPythonConnection();
        }
      } else {
        checkPythonConnection();
      }
    };
    
    loadConfig();
    
    // Listen for backend status updates
    if (window.electron) {
      const backendStatusListener = (status) => {
        console.log('Backend status update received:', status);
        if (status.port) {
          setPythonPort(status.port);
        }
        
        if (status.status === 'running') {
          checkPythonConnection();
        } else if (['crashed', 'failed', 'stopped'].includes(status.status)) {
          setPythonStatus('disconnected');
        }
      };
      
      window.electron.receive('backend-status', backendStatusListener);
      
      // Cleanup
      return () => {
        window.electron.removeListener('backend-status', backendStatusListener);
      };
    }
  }, []);

  const checkOllamaConnection = async (url: string) => {
    setOllamaStatus('checking');
    
    try {
      const response = await axios.get(`${url}/api/tags`, { timeout: 5000 });
      if (response.status === 200) {
        setOllamaStatus('connected');
      } else {
        setOllamaStatus('disconnected');
      }
    } catch (error) {
      console.error('Ollama connection error:', error);
      setOllamaStatus('disconnected');
    }
  };

  const checkPythonConnection = async () => {
    setPythonStatus('checking');
    setIsReconnecting(true);
    setReconnectError(null);
    
    try {
      // First check backend health
      const health = await api.checkHealth();
      
      if (health.status === 'connected') {
        setPythonStatus('connected');
        
        // Update port if it's different
        if (health.port && health.port !== pythonPort) {
          setPythonPort(health.port);
        }
        
        // Now try the actual test endpoint
        try {
          const result = await api.getTest();
          if (!result) {
            console.warn('Test endpoint returned empty result');
          }
        } catch (testError) {
          console.warn('Test endpoint error:', testError);
          // Don't change status for test errors if health check passed
        }
      } else {
        setPythonStatus('disconnected');
        setReconnectError('Failed to connect to Python backend');
      }
    } catch (error) {
      console.error('Python backend check failed:', error);
      setPythonStatus('disconnected');
      setReconnectError(error.message);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleSaveOllamaUrl = async () => {
    setIsConfiguring(true);
    try {
      const config = await db.getAPIConfig();
      await db.updateAPIConfig({
        comfyui_base_url: config?.comfyui_base_url || '',
        ollama_base_url: ollamaUrl
      });
      await checkOllamaConnection(ollamaUrl);
      setShowOllamaUrlInput(false);
    } catch (error) {
      console.error('Error saving Ollama URL:', error);
    } finally {
      setIsConfiguring(false);
    }
  };

  const renderStatusIcon = (status: 'checking' | 'connected' | 'disconnected') => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'connected':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'disconnected':
        return <XCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const showServiceStatus = ollamaStatus === 'disconnected';

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Welcome Section */}
        <div className="glassmorphic rounded-2xl p-8 animate-fadeIn">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-sakura-100 dark:bg-sakura-100/10 rounded-xl">
              <Bot className="w-8 h-8 text-sakura-500" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                  Welcome to Clara
                </h1>
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      pythonStatus === 'connected' 
                        ? 'bg-green-500 animate-pulse' 
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {pythonStatus === 'connected' 
                      ? pythonPort 
                        ? `Online (Port: ${pythonPort})` 
                        : 'Online' 
                      : 'Offline'}
                  </span>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Your AI assistant powered by Ollama and ComfyUI
              </p>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Chat Action */}
            <button 
              onClick={() => onPageChange?.('assistant')}
              className="group flex flex-col rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-sakura-50 dark:hover:bg-sakura-100/5 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <Bot className="w-6 h-6 text-sakura-500" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sakura-500 transform group-hover:translate-x-1 transition-all" />
              </div>
              <div className="px-6 pb-6 flex-grow">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Start Chatting
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Chat with Clara using various AI models through Ollama
                </p>
              </div>
            </button>

            {/* Image Generation Action */}
            <button 
              onClick={() => onPageChange?.('image-gen')}
              className="group flex flex-col rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-sakura-50 dark:hover:bg-sakura-100/5 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <ImageIcon className="w-6 h-6 text-sakura-500" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sakura-500 transform group-hover:translate-x-1 transition-all" />
              </div>
              <div className="px-6 pb-6 flex-grow">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Generate Images
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create stunning images using Stable Diffusion
                </p>
              </div>
            </button>

            {/* Settings Action */}
            <button 
              onClick={() => onPageChange?.('settings')}
              className="group flex flex-col rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-sakura-50 dark:hover:bg-sakura-100/5 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <Settings className="w-6 h-6 text-sakura-500" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sakura-500 transform group-hover:translate-x-1 transition-all" />
              </div>
              <div className="px-6 pb-6 flex-grow">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Configure Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize Clara to match your preferences
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Service Status Section - Only show if Ollama is disconnected */}
        {showServiceStatus && (
          <div className="glassmorphic rounded-2xl p-8 animate-fadeIn animation-delay-200">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Service Status
            </h2>
            
            <div>
              {/* Ollama Status */}
              <div className="p-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-800/30 rounded-lg">
                      <MessageSquare className="w-6 h-6 text-red-500 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Ollama Not Connected
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Chat functionality will be unavailable
                      </p>
                    </div>
                  </div>
                  {renderStatusIcon(ollamaStatus)}
                </div>

                {showOllamaUrlInput ? (
                  <div className="animate-fadeIn">
                    <div className="flex gap-4 mb-4">
                      <input
                        type="url"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="flex-1 px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sakura-300"
                      />
                      <button
                        onClick={handleSaveOllamaUrl}
                        disabled={isConfiguring}
                        className="px-6 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isConfiguring ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Enter the URL where your Ollama instance is running
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowOllamaUrlInput(true)}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/30"
                    >
                      Configure Ollama URL
                    </button>
                    {ollamaUrl && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Current URL: {ollamaUrl}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Python Backend Status */}
              <div className="mt-4 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-800/30 rounded-lg">
                      <Server className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Python Backend
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {pythonStatus === 'connected'
                          ? `Connected on port ${pythonPort || 'unknown'}`
                          : 'Backend service status'}
                      </p>
                    </div>
                  </div>
                  {renderStatusIcon(pythonStatus)}
                </div>
                
                {pythonStatus !== 'connected' && (
                  <div className="mt-4">
                    <button
                      onClick={checkPythonConnection}
                      disabled={isReconnecting}
                      className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/30 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isReconnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Refresh Connection
                        </>
                      )}
                    </button>
                    
                    {reconnectError && (
                      <p className="mt-2 text-xs text-red-500">
                        Error: {reconnectError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Capabilities Showcase */}
        <div className="glassmorphic rounded-2xl p-8 animate-fadeIn animation-delay-400">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-green-100 dark:bg-green-800/30 rounded-xl">
              <Zap className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                What You Can Do
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Explore Clara's capabilities
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Code className="w-5 h-5 text-indigo-500" />
                <h3 className="font-medium text-gray-900 dark:text-white">Code Assistant</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ask about coding problems, debug issues, or generate code snippets in multiple languages.
              </p>
            </div>
            
            <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-emerald-500" />
                <h3 className="font-medium text-gray-900 dark:text-white">Content Creation</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate creative writing, summaries, translations, or professional documents.
              </p>
            </div>
            
            <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <ImageIcon className="w-5 h-5 text-pink-500" />
                <h3 className="font-medium text-gray-900 dark:text-white">Image Generation</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create custom images with detailed prompts, adjust styles, and explore various artistic effects.
              </p>
            </div>
          </div>
        </div>
        
        {/* What's New Section */}
        <div className="glassmorphic rounded-2xl p-8 animate-fadeIn animation-delay-450 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-sakura-200 dark:bg-sakura-500/20 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-200 dark:bg-blue-500/20 rounded-full blur-3xl opacity-50"></div>
          
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-purple-100 dark:bg-purple-800/30 rounded-xl">
                <Star className="w-8 h-8 text-purple-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                  What's New in Clara
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-sakura-500 to-purple-500 text-white text-xs font-medium">
                  <RefreshCw className="w-3 h-3" />
                  Latest Updates
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-sakura-200 dark:border-sakura-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-sakura-100 dark:bg-sakura-900/30">
                    <FileText className="w-5 h-5 text-sakura-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Knowledge Base System</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Store documents and personalize Clara to speak based on your data and facts. Upload your content and get responses that adapt to your specific information, enabling more accurate and contextually relevant interactions.
                </p>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-indigo-200 dark:border-indigo-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Server className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Enhanced Python Backend</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Significantly improved Python backend with better stability, faster response times, and expanded capabilities. The new architecture supports more complex operations and lays the groundwork for upcoming advanced features.
                </p>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Coming Soon: MCP & Agentic Functions</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get ready for Mission Control Protocol (MCP) and a new Node system with Agentic functions. These upcoming features will enable complex task automation, multi-step reasoning, and sophisticated workflows all within Clara's interface.
                </p>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-amber-200 dark:border-amber-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Settings className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white">UI and QOL Improvements</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Numerous UI refinements and quality-of-life updates make Clara more reliable and user-friendly. Enjoy smoother transitions, improved responsiveness, and a more intuitive design that enhances your overall experience.
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <a 
                href="https://github.com/badboysm890/Clara-Ollama" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                View on GitHub
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        
        {/* Privacy Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 animate-fadeIn animation-delay-500 flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-full flex-shrink-0 mt-1">
            <Info className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-1">Private & Secure</h3>
            <p className="text-sm text-blue-600/90 dark:text-blue-400/90">
              Clara runs locally on your machine. Your chats, images, and data stay on your device and are never sent to external servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
