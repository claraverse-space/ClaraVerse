import React, { useState, useEffect } from 'react';
import { 
  Bot,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ImageIcon,
  Wand2
} from 'lucide-react';
import { db } from '../db';
import { Client } from '@stable-canvas/comfyui-client';

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const [comfyUrl, setComfyUrl] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showUrlInput, setShowUrlInput] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await db.getAPIConfig();
      if (config?.comfyui_base_url) {
        setComfyUrl(config.comfyui_base_url);
        checkComfyConnection(config.comfyui_base_url);
      } else {
        setComfyStatus('disconnected');
      }
    };
    loadConfig();
  }, []);

  const checkComfyConnection = async (url: string) => {
    setComfyStatus('checking');
    try {
      const client = new Client({
        api_host: url,
        secure: url.startsWith('https')
      });
      await client.connect();
      setComfyStatus('connected');
    } catch (error) {
      console.error('ComfyUI connection error:', error);
      setComfyStatus('disconnected');
    }
  };

  const handleSaveComfyUrl = async () => {
    setIsConfiguring(true);
    try {
      await db.updateAPIConfig({
        comfyui_base_url: comfyUrl,
        ollama_base_url: (await db.getAPIConfig())?.ollama_base_url || ''
      });
      await checkComfyConnection(comfyUrl);
      setShowUrlInput(false);
    } catch (error) {
      console.error('Error saving ComfyUI URL:', error);
    } finally {
      setIsConfiguring(false);
    }
  };

  const renderStatusIcon = () => {
    switch (comfyStatus) {
      case 'checking':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'connected':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'disconnected':
        return <XCircle className="w-6 h-6 text-red-500" />;
    }
  };

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
              className="group p-6 rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-sakura-50 dark:hover:bg-sakura-100/5 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <Bot className="w-6 h-6 text-sakura-500" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sakura-500 transform group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Start Chatting
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chat with Clara using various AI models through Ollama
              </p>
            </button>

            {/* Image Generation Action */}
            <button 
              onClick={() => onPageChange?.('image-gen')}
              className="group p-6 rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-sakura-50 dark:hover:bg-sakura-100/5 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <ImageIcon className="w-6 h-6 text-sakura-500" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sakura-500 transform group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Generate Images
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create stunning images using Stable Diffusion
              </p>
            </button>

            {/* Settings Action */}
            <button 
              onClick={() => onPageChange?.('settings')}
              className="group p-6 rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-sakura-50 dark:hover:bg-sakura-100/5 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <Settings className="w-6 h-6 text-sakura-500" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sakura-500 transform group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Configure Settings
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize Clara to match your preferences
              </p>
            </button>
          </div>
        </div>

        {/* ComfyUI Status Section */}
        <div className="glassmorphic rounded-2xl p-8 animate-fadeIn animation-delay-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-purple-100 dark:bg-purple-100/10 rounded-xl">
                <Wand2 className="w-8 h-8 text-purple-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  ComfyUI Integration
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Advanced image generation workflows
                </p>
              </div>
            </div>
            {renderStatusIcon()}
          </div>

          {showUrlInput ? (
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
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-full text-sm ${
                  comfyStatus === 'connected'
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                }`}>
                  {comfyStatus === 'connected' ? 'Connected' : 'Not Connected'}
                </div>
                <button
                  onClick={() => setShowUrlInput(true)}
                  className="text-sakura-500 hover:text-sakura-600 text-sm font-medium"
                >
                  {comfyStatus === 'connected' ? 'Change URL' : 'Configure Now'}
                </button>
              </div>
              {comfyUrl && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current URL: {comfyUrl}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;