import React, { useRef, useEffect, useState } from 'react';
import { Home, Bot, CheckCircle2, AlertCircle, ChevronDown, Sun, Moon, Image as ImageIcon, Star, BarChart3, Database } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { db } from '../../db';
import UserProfileButton from '../common/UserProfileButton';

interface AssistantHeaderProps {
  connectionStatus: 'checking' | 'connected' | 'disconnected';
  selectedModel: string;
  models: any[];
  showModelSelect: boolean;
  setShowModelSelect: (show: boolean) => void;
  setSelectedModel: (model: string) => void;
  onPageChange: (page: string) => void;
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onOpenKnowledgeBase: () => void;
}

interface Model {
  name: string;
  id?: string;
  digest?: string;
  details?: any;
}

const AssistantHeader: React.FC<AssistantHeaderProps> = ({
  connectionStatus,
  selectedModel,
  models,
  showModelSelect,
  setShowModelSelect,
  setSelectedModel,
  onPageChange,
  onNavigateHome,
  onOpenSettings,
  onOpenKnowledgeBase
}) => {
  const { isDark, toggleTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string>('');
  const [modelConfigs, setModelConfigs] = useState<Record<string, boolean>>({});
  const [modelUsage, setModelUsage] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredModels, setFilteredModels] = useState<any[]>([]);

  useEffect(() => {
    const loadUserName = async () => {
      const personalInfo = await db.getPersonalInfo();
      if (personalInfo?.name) {
        setUserName(personalInfo.name);
      }
    };
    loadUserName();
  }, []);

  useEffect(() => {
    const configs = localStorage.getItem('model_image_support');
    if (configs) {
      const parsedConfigs = JSON.parse(configs);
      const configMap = parsedConfigs.reduce((acc: Record<string, boolean>, curr: any) => {
        acc[curr.name] = curr.supportsImages;
        return acc;
      }, {});
      setModelConfigs(configMap);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelSelect(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowModelSelect]);

  useEffect(() => {
    const loadModelUsage = async () => {
      const usage = await db.getModelUsage();
      if (usage) {
        setModelUsage(usage);
      }
    };
    loadModelUsage();
  }, []);

  useEffect(() => {
    // Initialize filtered models with all models
    setFilteredModels(models);
  }, [models]);

  const getMostUsedModel = (): string | null => {
    if (!modelUsage || Object.keys(modelUsage).length === 0) return null;
    
    let maxUsage = 0;
    let mostUsedModel = null;
    
    for (const [model, usage] of Object.entries(modelUsage)) {
      if (usage > maxUsage) {
        maxUsage = usage;
        mostUsedModel = model;
      }
    }
    
    return mostUsedModel;
  };

  const handleModelSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase().trim();
    setSearchTerm(term);
    
    if (!term) {
      setFilteredModels(models);
    } else {
      const filtered = models.filter(model => 
        model.name.toLowerCase().includes(term) || model.id?.toLowerCase().includes(term)
      );
      setFilteredModels(filtered);
    }
  };

  const renderModelDetails = (model: Model) => {
    const modelId = model.name || model.id;
    const isOllamaModel = typeof model.digest === 'string';

    return (
      <button
        key={modelId}
        onClick={() => {
          setSelectedModel(modelId);
          setShowModelSelect(false);
          setSearchTerm('');
        }}
        className={`w-full flex items-center justify-between p-3 text-left hover:bg-sakura-50 dark:hover:bg-sakura-100/5 ${
          selectedModel === modelId ? 'bg-sakura-50 dark:bg-sakura-100/10' : ''
        } ${modelId === mostUsedModel ? 'border-l-4 border-yellow-400' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-gray-500" />
          <div>
            <div className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              {modelId}
              {modelId === mostUsedModel && (
                <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <Star className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs text-yellow-700 dark:text-yellow-400">Most Used</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              {isOllamaModel ? (
                <span>{model.digest?.slice(0, 8)}</span>
              ) : (
                <span>OpenAI Model</span>
              )}
              {modelUsage[modelId] && (
                <div className="flex items-center gap-1 ml-1">
                  <BarChart3 className="w-3 h-3 text-blue-500" />
                  <span>Used: {modelUsage[modelId]} times</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {modelConfigs[modelId] && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-sakura-100/50 dark:bg-sakura-100/10">
            <ImageIcon className="w-3 h-3 text-sakura-500" />
            <span className="text-xs text-sakura-500">Images</span>
          </div>
        )}
      </button>
    );
  };

  const mostUsedModel = getMostUsedModel();

  return (
    <div className="h-16 glassmorphic flex items-center justify-between px-6 relative z-20">
      {/* Left section with fixed width */}
      <div className="flex items-center gap-4 w-[500px]">
        <button 
          onClick={onNavigateHome}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-700 dark:text-gray-300"
        >
          <Home className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50">
          {connectionStatus === 'checking' ? (
            <Bot className="w-5 h-5 text-yellow-500 animate-spin" />
          ) : connectionStatus === 'connected' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {connectionStatus === 'checking' ? 'Checking Connection...' :
             connectionStatus === 'connected' ? 'Connected' :
             'Disconnected'}
          </span>
        </div>
      </div>

      {/* Center section with model selector */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowModelSelect(!showModelSelect)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors"
            disabled={connectionStatus !== 'connected'}
          >
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="text-sm font-medium">{selectedModel || 'Select Model'}</span>
              {selectedModel === mostUsedModel && (
                <Star className="w-4 h-4 text-yellow-500" title="Most used model" />
              )}
              {modelConfigs[selectedModel] && (
                <ImageIcon className="w-4 h-4 text-sakura-500" />
              )}
            </div>
            <ChevronDown className="w-4 h-4" />
          </button>
          {showModelSelect && (
            <div className="absolute top-full left-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={handleModelSearch}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm"
                  autoFocus
                />
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredModels.length > 0 ? (
                  filteredModels.map(model => renderModelDetails(model))
                ) : (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No models match your search
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right section with fixed width */}
      <div className="flex items-center gap-4 w-[500px] justify-end">
        <button
          onClick={onOpenKnowledgeBase}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors whitespace-nowrap"
          title="Knowledge Base"
        >
          <Database className="w-5 h-5" />
          <span className="text-sm font-medium">Knowledge Base</span>
        </button>

        <button 
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>

        <UserProfileButton
          userName={userName || 'Profile'}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
};

export default AssistantHeader;