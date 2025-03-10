import React, { useEffect, useState } from 'react';
import { 
  Coins, 
  Database, 
  MessageSquare, 
  Clock, 
  Smartphone,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Settings as SettingsIcon,
  Search,
  Send,
  Bot
} from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import { db } from '../db';
import type { APIConfig } from '../db';
import { OllamaClient } from '../utils';

const Dashboard = ({ onPageChange }: { onPageChange?: (page: string) => void }) => {
  const { stats } = useDatabase();
  const [apiConfig, setApiConfig] = useState<APIConfig | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected' | 'not_configured'>('checking');
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      e.preventDefault();
      // Navigate to assistant page
      onPageChange?.('assistant');
      // Store the search query in localStorage to be picked up by Assistant component
      localStorage.setItem('pending_chat_query', searchInput.trim());
      // Clear the input
      setSearchInput('');
    }
  };

  const handleSearchClick = () => {
    if (searchInput.trim()) {
      // Navigate to assistant page
      onPageChange?.('assistant');
      // Store the search query in localStorage to be picked up by Assistant component
      localStorage.setItem('pending_chat_query', searchInput.trim());
      // Clear the input
      setSearchInput('');
    }
  };

  useEffect(() => {
    const checkOllamaStatus = async () => {
      const config = await db.getAPIConfig();
      setApiConfig(config);

      if (!config?.ollama_base_url) {
        setOllamaStatus('not_configured');
        return;
      }

      try {
        const client = new OllamaClient(config.ollama_base_url);
        const isConnected = await client.ping();
        setOllamaStatus(isConnected ? 'connected' : 'disconnected');
      } catch (error) {
        setOllamaStatus('disconnected');
      }
    };

    checkOllamaStatus();
    // Check status every 30 seconds
    const interval = setInterval(checkOllamaStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const statsConfig = [
    { icon: Coins, label: 'Tokens Used', value: stats.tokensUsed, change: '+12.5%', up: true },
    { icon: Database, label: 'Data Stored', value: stats.totalStorage, change: '+5.2%', up: true },
    { icon: MessageSquare, label: 'Total Messages', value: stats.messageCount, change: '+8.1%', up: true },
    { icon: Clock, label: 'Avg. Response', value: stats.averageResponseTime, change: '-0.3s', up: false },
  ];

  const getOllamaStatusInfo = () => {
    switch (ollamaStatus) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          message: 'Ollama server is running and responding',
          color: 'text-green-500'
        };
      case 'disconnected':
        return {
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          message: 'Ollama server is not responding. Is it running?',
          color: 'text-red-500'
        };
      case 'checking':
        return {
          icon: <Clock className="w-5 h-5 text-yellow-500 animate-spin" />,
          message: 'Checking Ollama server status...',
          color: 'text-yellow-500'
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
          message: 'Please configure Ollama base URL in settings',
          color: 'text-yellow-500'
        };
    }
  };

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto flex flex-col">
      {/* Mobile Warning */}
      <div className="lg:hidden mb-6">
        <div className="glassmorphic rounded-xl p-4 border-l-4 border-yellow-400">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-yellow-400" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Mobile View Limited
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Our devs were too busy playing ping pong. Mobile version coming... eventually™
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 flex-grow">
        {/* Welcome message and search input - moved to top */}
        <div className="glassmorphic rounded-xl p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-sakura-100 dark:bg-sakura-100/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-sakura-500" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to Clara
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-lg">
              Your AI assistant powered by Ollama. Ask me anything about code, data, or general knowledge.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Ask Clara anything..."
                className="w-full pl-12 pr-16 py-3 rounded-full bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400 shadow-sm"
              />
              <button
                onClick={handleSearchClick}
                disabled={!searchInput.trim()}
                className="absolute right-3 p-2 rounded-full bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsConfig.map((stat) => (
            <div key={stat.label} className="glassmorphic rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sakura-100 dark:bg-sakura-100/10 rounded-lg">
                  <stat.icon className="w-6 h-6 text-sakura-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {stat.value}
                    </p>
                    <span className={`flex items-center text-sm ${stat.up ? 'text-green-500' : 'text-red-500'}`}>
                      {stat.up ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                      {stat.change}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* API Configuration Status */}
        <div className="glassmorphic rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              API Configuration Status
            </h2>
            <SettingsIcon className="w-5 h-5 text-sakura-500" />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
              <div className="w-10 h-10 rounded-full bg-sakura-100 dark:bg-sakura-100/10 flex items-center justify-center">
                {getOllamaStatusInfo().icon}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Ollama Configuration
                </h4>
                <p className={`text-sm ${getOllamaStatusInfo().color}`}>
                  {getOllamaStatusInfo().message}
                </p>
              </div>
              {ollamaStatus === 'not_configured' && (
                <a
                  href="#settings"
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector('[data-page="settings"]')?.click();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-sakura-500 rounded-lg hover:bg-sakura-600 transition-colors"
                >
                  Configure
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;