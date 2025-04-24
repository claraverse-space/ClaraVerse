import React, { useRef, useEffect, useState } from 'react';
import { Home, Bot, CheckCircle2, AlertCircle, ChevronDown, Sun, Moon, Image as ImageIcon, Star, BarChart3, Database, RefreshCw, Loader2, Settings, Wrench, Zap, Hand } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { db } from '../../db';
import UserProfileButton from '../common/UserProfileButton';
import { ChevronDownIcon, HomeIcon } from '@heroicons/react/24/outline';
import { Tool } from 'lucide-react';

interface AssistantHeaderProps {
  connectionStatus: 'checking' | 'connected' | 'disconnected';
  selectedModel: string;
  models: Array<{ name: string; id: string }>;
  showModelSelect: boolean;
  setShowModelSelect: (show: boolean) => void;
  setSelectedModel: (model: string) => void;
  onPageChange: (page: string) => void;
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onOpenKnowledgeBase: () => void;
  onOpenTools: () => void;
  modelSelectionMode?: 'auto' | 'manual' | 'smart';
  onModeChange?: (mode: 'auto' | 'manual' | 'smart') => void;
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
  onOpenKnowledgeBase,
  onOpenTools,
  modelSelectionMode = 'manual',
  onModeChange
}) => {
  const { isDark, toggleTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string>('');
  const [modelConfigs, setModelConfigs] = useState<Record<string, boolean>>({});
  const [modelUsage, setModelUsage] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredModels, setFilteredModels] = useState<any[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastSelectedModel, setLastSelectedModel] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);

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
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setShowModeSelect(false);
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

  // Track model changes for success message
  useEffect(() => {
    if (selectedModel && selectedModel !== lastSelectedModel) {
      setShowSuccessMessage(true);
      setLastSelectedModel(selectedModel);
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedModel, lastSelectedModel]);

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

  // Add refresh models function
  const handleRefreshModels = async () => {
    if (!window.electron || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      if (data.models) {
        setFilteredModels(data.models);
      }
    } catch (error) {
      console.error('Error refreshing models:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleModeSelect = (mode: 'auto' | 'manual' | 'smart') => {
    if (onModeChange) {
      onModeChange(mode);
    }
    setShowModeSelect(false);
  };

  return (
    <div className="h-16 glassmorphic flex items-center justify-between px-6 relative z-20">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg shadow-lg flex items-center gap-2 animate-fade-out">
          <CheckCircle2 className="w-4 h-4" />
          <span>Model "{selectedModel}" is now ready to use!</span>
        </div>
      )}

      {/* Left section with fixed width */}
      <div className="flex items-center gap-4 w-[500px]">
        <button 
          onClick={onNavigateHome}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-700 dark:text-gray-300"
        >
          <Home className="w-5 h-5" />
          <span>Back to Home</span>
        </button>
      </div>

      {/* Center section with model selector */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {/* Only show model selector in manual mode */}
        {modelSelectionMode === 'manual' && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowModelSelect(!showModelSelect)}
              disabled={connectionStatus !== 'connected'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                connectionStatus === 'connected'
                  ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-green-500'
                      : connectionStatus === 'checking'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-gray-700 dark:text-gray-300">
                  {selectedModel || 'Select Model'}
                </span>
              </div>
              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
            </button>

            {showModelSelect && (
              <div className="absolute top-full left-0 mt-2 w-64 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50">
                {models.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => {
                      setSelectedModel(model.name);
                      setShowModelSelect(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show current mode indicator when not in manual mode */}
        <div className="relative" ref={modeDropdownRef}>
          <button
            onClick={() => setShowModeSelect(!showModeSelect)}
            className="px-3 py-1.5 rounded-lg text-sm bg-sakura-50 dark:bg-sakura-900/20 text-sakura-600 dark:text-sakura-300 hover:bg-sakura-100 dark:hover:bg-sakura-900/30 transition-colors flex items-center gap-2"
          >
            {modelSelectionMode === 'auto' ? (
              <>
                <Zap className="w-4 h-4" />
                <span>Auto Mode</span>
              </>
            ) : (
              <>
                <Hand className="w-4 h-4" />
                <span>Manual Mode</span>
              </>
            )}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showModeSelect && (
            <div className="absolute top-full left-0 mt-2 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50">
              <button
                onClick={() => handleModeSelect('auto')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  modelSelectionMode === 'auto' ? 'bg-sakura-50 dark:bg-sakura-900/20 text-sakura-600 dark:text-sakura-300' : 'text-gray-700 dark:text-gray-300'
                } flex items-center gap-2`}
              >
                <Zap className="w-4 h-4" />
                Auto Mode
              </button>
              <button
                onClick={() => handleModeSelect('manual')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  modelSelectionMode === 'manual' ? 'bg-sakura-50 dark:bg-sakura-900/20 text-sakura-600 dark:text-sakura-300' : 'text-gray-700 dark:text-gray-300'
                } flex items-center gap-2`}
              >
                <Hand className="w-4 h-4" />
                Manual Mode
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleRefreshModels}
          disabled={connectionStatus !== 'connected' || isRefreshing}
          className="p-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh model list"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Right section with actions */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'checking' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-100/50 dark:bg-yellow-900/30">
              <Bot className="w-4 h-4 text-yellow-500 animate-spin" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400">Checking...</span>
            </div>
          ) : connectionStatus === 'connected' ? (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Connected" />
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-100/50 dark:bg-red-900/30">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-400">Disconnected</span>
            </div>
          )}
        </div>

        {/* Knowledge Base Button */}
        <button
          onClick={onOpenKnowledgeBase}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          title="Knowledge Base"
        >
          <Database className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">Knowledge Base</span>
        </button>

        {/* Tools Button */}
        <button
          onClick={onOpenTools}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          title="Tools"
        >
          <Wrench className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">Tools</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          ) : (
            <Moon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          )}
        </button>

        {/* User Profile */}
        <UserProfileButton 
          userName={userName} 
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
};

export default AssistantHeader;