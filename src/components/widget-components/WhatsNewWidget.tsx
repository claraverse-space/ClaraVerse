import React from 'react';
import { 
  Star, 
  XCircle, 
  RefreshCw, 
  TerminalSquare, 
  Cpu, 
  Database, 
  Trash2, 
  ArrowRight 
} from 'lucide-react';

interface WhatsNewWidgetProps {
  id: string;
  onRemove: (id: string) => void;
}

const WhatsNewWidget: React.FC<WhatsNewWidgetProps> = ({ id, onRemove }) => {
  return (
    <div className="glassmorphic rounded-2xl p-8 animate-fadeIn animation-delay-450 relative overflow-hidden group">
      {/* Remove button */}
      <button
        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(id)}
        aria-label="Remove widget"
      >
        <XCircle className="w-5 h-5" />
      </button>

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
          <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-indigo-200 dark:border-indigo-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md relative overflow-hidden group">
            <div className="absolute -right-12 -top-12 w-24 h-24 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <TerminalSquare className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                Tool Calling Functionality
                <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full">New</span>
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Clara now features advanced tool calling capabilities, enabling AI to execute specific functions and access external systems.
            </p>
          </div>
          
          <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md relative overflow-hidden group">
            <div className="absolute -left-12 -bottom-12 w-24 h-24 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Cpu className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                Custom Model Installation
                <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full">New</span>
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Personalize your AI experience with our new custom model installation option.
            </p>
          </div>
          
          <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-amber-200 dark:border-amber-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md relative overflow-hidden group">
            <div className="absolute -right-12 -bottom-12 w-24 h-24 bg-amber-200/30 dark:bg-amber-500/10 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Database className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                Optimized RAG System
                <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-full">Improved</span>
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Experience a significantly enhanced Retrieval-Augmented Generation system with better performance.
            </p>
          </div>
          
          <div className="bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl border border-rose-200 dark:border-rose-800/50 backdrop-blur-sm transform transition-transform hover:scale-102 hover:shadow-md relative overflow-hidden group">
            <div className="absolute -left-12 -top-12 w-24 h-24 bg-rose-200/30 dark:bg-rose-500/10 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                Database Purging Option
                <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full">New</span>
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Take complete control of your data with our new RAG database purging feature.
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
  );
};

export default WhatsNewWidget; 