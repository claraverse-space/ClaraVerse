import React, { useEffect, useState } from 'react';
import { Box, Network, Server, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { OllamaModel } from './OllamaTypes';
import OllamaService from './OllamaService';
import ollamaSettingsStore from './OllamaSettingsStore';

interface OllamaModelSelectorProps {
  onModelSelect: (model: OllamaModel) => void;
  selectedModelId?: string;
  className?: string;
  compact?: boolean;
}

const OllamaModelSelector: React.FC<OllamaModelSelectorProps> = ({
  onModelSelect,
  selectedModelId,
  className = '',
  compact = false,
}) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Initialize Ollama service with current settings
  const connection = ollamaSettingsStore.getConnection();
  const ollamaService = new OllamaService(connection);
  
  const fetchModels = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First check if we can connect to Ollama
      const isConnected = await ollamaService.checkConnection();
      
      if (!isConnected) {
        setConnectionStatus('disconnected');
        setError('Could not connect to Ollama server');
        setIsLoading(false);
        return;
      }
      
      setConnectionStatus('connected');
      
      // Fetch models
      const modelList = await ollamaService.getModels();
      setModels(modelList.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching models');
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load models when component mounts or connection changes
  useEffect(() => {
    fetchModels();
    
    // Subscribe to connection changes
    const unsubscribe = ollamaSettingsStore.subscribe((newConnection) => {
      ollamaService.setConnection(newConnection);
      fetchModels();
    });
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.model-selector-dropdown')) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle model selection
  const handleModelSelect = (model: OllamaModel) => {
    onModelSelect(model);
    setIsDropdownOpen(false);
  };
  
  const renderModelSize = (size: number) => {
    const gb = size / 1024 / 1024 / 1024;
    if (gb >= 1) {
      return `${gb.toFixed(1)} GB`;
    }
    const mb = size / 1024 / 1024;
    return `${mb.toFixed(0)} MB`;
  };
  
  // Render connection status
  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Checking connection...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center text-green-500 text-xs">
            <Check className="w-3 h-3 mr-1" />
            Connected to Ollama
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center text-red-500 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Not connected
          </div>
        );
    }
  };

  // Compact view for the dropdown selector
  if (compact) {
    // Find the currently selected model
    const selectedModel = models.find(model => model.name === selectedModelId);
    const selectedModelName = selectedModel?.name || 'Select model';
    
    return (
      <div className={`relative model-selector-dropdown ${className}`}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full px-2 py-1 text-xs text-left flex items-center justify-between rounded-md bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <span className="truncate">{selectedModelName}</span>
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isDropdownOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
            {isLoading ? (
              <div className="p-2 text-center">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-gray-500" />
              </div>
            ) : models.length === 0 ? (
              <div className="p-2 text-center text-xs text-gray-500">
                No models available
              </div>
            ) : (
              models.map((model) => (
                <div
                  key={model.name}
                  className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedModelId === model.name ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => handleModelSelect(model)}
                >
                  {model.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Original full view
  return (
    <div className={`rounded-lg ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <Box className="w-4 h-4 mr-2 text-sakura-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Ollama Models</h3>
        </div>
        
        <div className="flex items-center">
          {renderConnectionStatus()}
          
          <button 
            onClick={fetchModels} 
            className="ml-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            disabled={isLoading}
            title="Refresh models"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2 mb-3 text-xs text-red-800 dark:text-red-400">
          <p className="flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1.5 flex-shrink-0" />
            {error}
          </p>
          <p className="mt-1 ml-4.5">
            Make sure Ollama is running and check your connection settings.
          </p>
        </div>
      )}
      
      <div className="mt-2">
        {isLoading ? (
          <div className="p-4 flex justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-sakura-500" />
          </div>
        ) : models.length === 0 ? (
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-md text-gray-500 dark:text-gray-400 text-sm">
            <Server className="w-5 h-5 mx-auto mb-2 opacity-70" />
            <p>No models found in Ollama</p>
            <p className="text-xs mt-1">Try pulling a model using the Ollama CLI</p>
            <code className="block mt-2 bg-gray-100 dark:bg-gray-800 p-1 text-xs rounded">
              ollama pull llama3
            </code>
          </div>
        ) : (
          <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700">
            {models.map((model) => (
              <div 
                key={model.name}
                className={`flex justify-between items-center p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                  selectedModelId === model.name ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => handleModelSelect(model)}
              >
                <div className="flex items-center">
                  <Network className={`w-4 h-4 mr-2 ${
                    selectedModelId === model.name ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <div>
                    <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                      {model.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {model.details?.parameter_size || 'Unknown size'} • {model.details?.family || 'Unknown family'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {renderModelSize(model.size)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OllamaModelSelector; 