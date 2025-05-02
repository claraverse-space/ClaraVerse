import React from 'react';
import { Bot, XCircle, ArrowRight, ImageIcon, Settings, Cpu, Server } from 'lucide-react';

interface WelcomeWidgetProps {
  id: string;
  onRemove: (id: string) => void;
  pythonStatus: 'checking' | 'connected' | 'disconnected';
  pythonPort: number | null;
  onPageChange?: (page: string) => void;
}

const WelcomeWidget: React.FC<WelcomeWidgetProps> = ({ 
  id, 
  onRemove, 
  pythonStatus, 
  pythonPort,
  onPageChange 
}) => {
  return (
    <div className="glassmorphic rounded-2xl p-8 animate-fadeIn relative group">
      <button
        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(id)}
        aria-label="Remove widget"
      >
        <XCircle className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 bg-sakura-100 dark:bg-sakura-100/10 rounded-xl">
          <Bot className="w-8 h-8 text-sakura-500" />
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              Clara 
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
                    ? `Diagnostics complete. Systems nominal. Online and ready.` 
                    : 'Online' 
                  : 'Diagnostics failed. Glitch in the matrix. Try rebooting me.'}
              </span>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Here to speed up your workflow, protect your privacy, and work even when you're offline.
          </p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Chat Action */}
        <button 
          onClick={() => onPageChange?.('assistant')}
          className="group flex flex-col items-center text-center rounded-2xl bg-gradient-to-b from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 pt-10"
        >
          <div className="mb-4">
            <div className="p-4 bg-sakura-100/50 dark:bg-sakura-500/20 rounded-2xl backdrop-blur-sm">
              <Bot className="w-8 h-8 text-sakura-500" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Start Chatting
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Chat with Clara and tools
          </p>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-sakura-500 transform group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
        </button>

        {/* Agents Action */}
        <button 
          onClick={() => onPageChange?.('apps')}
          className="group flex flex-col items-center text-center rounded-2xl bg-gradient-to-b from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 pt-10"
        >
          <div className="mb-4">
            <div className="p-4 bg-blue-100/50 dark:bg-blue-500/20 rounded-2xl backdrop-blur-sm">
              <Cpu className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Agents
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Manage and interact with AI agents
          </p>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
        </button>

        {/* Automation Action */}
        <button 
          onClick={() => onPageChange?.('n8n')}
          className="group flex flex-col items-center text-center rounded-2xl bg-gradient-to-b from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 pt-10"
        >
          <div className="mb-4">
            <div className="p-4 bg-purple-100/50 dark:bg-purple-500/20 rounded-2xl backdrop-blur-sm">
              <Server className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Automation
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Create and manage workflows
          </p>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transform group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
        </button>

        {/* Settings Action */}
        <button 
          onClick={() => onPageChange?.('settings')}
          className="group flex flex-col items-center text-center rounded-2xl bg-gradient-to-b from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 pt-10 pb-6"
        >
          <div className="mb-4">
            <div className="p-4 bg-emerald-100/50 dark:bg-emerald-500/20 rounded-2xl backdrop-blur-sm">
              <Settings className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Configure Settings
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Customize Clara preferences
          </p>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
        </button>
      </div>
    </div>
  );
};

export default WelcomeWidget; 