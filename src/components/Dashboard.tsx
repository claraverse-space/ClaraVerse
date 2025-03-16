import React, { useState, useEffect } from 'react';
import { 
  Bot,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ImageIcon,
  Wand2,
  MessageSquare
} from 'lucide-react';
import { db } from '../db';
import { Client } from '@stable-canvas/comfyui-client';
import axios from 'axios';

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const [comfyUrl, setComfyUrl] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showComfyUrlInput, setShowComfyUrlInput] = useState(false);
  const [showOllamaUrlInput, setShowOllamaUrlInput] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await db.getAPIConfig();
      
      if (config?.comfyui_base_url) {
        setComfyUrl(config.comfyui_base_url);
        checkComfyConnection(config.comfyui_base_url);
      } else {
        setComfyStatus('disconnected');
      }
      
      if (config?.ollama_base_url) {
        setOllamaUrl(config.ollama_base_url);
        checkOllamaConnection(config.ollama_base_url);
      } else {
        setOllamaStatus('disconnected');
      }
    };
    loadConfig();
  }, []);

  const checkComfyConnection = async (url: string) => {
    setComfyStatus('checking');

    let urls = url;
    if (urls.includes('http://') || urls.includes('https://')) {
      urls = urls.split('//')[1];
    }
    try {
      const client = new Client({
        api_host: urls,
        ssl: url.startsWith('https')
      });
      await client.connect();
      setComfyStatus('connected');
      await client.disconnect();
    } catch (error) {
      console.error('ComfyUI connection error:', error);
      setComfyStatus('disconnected');
    }
  };

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

  const handleSaveComfyUrl = async () => {
    setIsConfiguring(true);
    try {
      await db.updateAPIConfig({
        comfyui_base_url: comfyUrl,
        ollama_base_url: ollamaUrl || (await db.getAPIConfig())?.ollama_base_url || ''
      });
      await checkComfyConnection(comfyUrl);
      setShowComfyUrlInput(false);
    } catch (error) {
      console.error('Error saving ComfyUI URL:', error);
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleSaveOllamaUrl = async () => {
    setIsConfiguring(true);
    try {
      await db.updateAPIConfig({
        comfyui_base_url: comfyUrl || (await db.getAPIConfig())?.comfyui_base_url || '',
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

  const showServiceStatus = ollamaStatus === 'disconnected' || comfyStatus === 'disconnected';

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Welcome Section */}
        <div className="glassmorphic rounded-2xl p-8 animate-fadeIn">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-sakura-100 dark:bg-sakura-100/10 rounded-xl">
              <Bot className="w-8 h-8 text-sakura-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                Welcome to Clara
              </h1>
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

        {/* Service Status Section - Only show if there's an issue */}
        {showServiceStatus && (
          <div className="glassmorphic rounded-2xl p-8 animate-fadeIn animation-delay-200">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Service Status
            </h2>
            
            <div className="space-y-8">
              {/* Ollama Status */}
              {ollamaStatus === 'disconnected' && (
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
              )}

              {/* ComfyUI Status */}
              {comfyStatus === 'disconnected' && (
                <div className="p-6 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 dark:bg-purple-800/30 rounded-lg">
                        <Wand2 className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          ComfyUI Not Connected
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Image generation will be unavailable
                        </p>
                      </div>
                    </div>
                    {renderStatusIcon(comfyStatus)}
                  </div>

                  {showComfyUrlInput ? (
                    <div className="animate-fadeIn">
                      <div className="flex gap-4 mb-4">
                        <input
                          type="url"
                          value={comfyUrl}
                          onChange={(e) => setComfyUrl(e.target.value)}
                          placeholder="http://localhost:8188"
                          className="flex-1 px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sakura-300"
                        />
                        <button
                          onClick={handleSaveComfyUrl}
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
                        Enter the URL where your ComfyUI instance is running
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setShowComfyUrlInput(true)}
                        className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/30"
                      >
                        Configure ComfyUI URL
                      </button>
                      {comfyUrl && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Current URL: {comfyUrl}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;