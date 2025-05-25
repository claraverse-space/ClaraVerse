/**
 * Clara Assistant Input Component
 * 
 * This component provides the input interface for the Clara assistant.
 * It handles text input, file uploads, and various assistant features.
 * 
 * Features:
 * - Multi-line text input with auto-resize
 * - Drag and drop file upload
 * - File type detection and preview
 * - Voice input (future)
 * - Model selection
 * - Advanced options
 * - Send/cancel functionality
 * - Keyboard shortcuts
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  File, 
  Wrench, 
  Zap, 
  Database, 
  Mic, 
  Settings, 
  Send, 
  Plus,
  X,
  Bot,
  ChevronDown,
  Square,
  Loader2,
  Upload,
  Paperclip,
  AlertCircle,
  Server,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Import types
import { 
  ClaraInputProps,
  ClaraFileAttachment,
  ClaraSessionConfig,
  ClaraFileType,
  ClaraProvider,
  ClaraModel,
  ClaraAIConfig,
  ClaraMCPServer
} from '../../types/clara_assistant_types';

// Import PDF.js for PDF processing
import * as pdfjsLib from 'pdfjs-dist';

// Import MCP service
import { claraMCPService } from '../../services/claraMCPService';

/**
 * Custom Tooltip Component
 */
const Tooltip: React.FC<{
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}> = ({ children, content, position = 'top', delay = 500 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = useCallback(() => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  }, [timeoutId]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2 left-1/2 transform -translate-x-1/2';
      case 'bottom':
        return 'top-full mt-2 left-1/2 transform -translate-x-1/2';
      case 'left':
        return 'right-full mr-2 top-1/2 transform -translate-y-1/2';
      case 'right':
        return 'left-full ml-2 top-1/2 transform -translate-y-1/2';
      default:
        return 'bottom-full mb-2 left-1/2 transform -translate-x-1/2';
    }
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${getPositionClasses()} z-50 animate-in fade-in-0 zoom-in-95 duration-200`}>
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg border border-gray-700 dark:border-gray-600 whitespace-nowrap">
            {content}
            {/* Tooltip arrow */}
            <div 
              className={`absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 border-gray-700 dark:border-gray-600 transform rotate-45 ${
                position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2 border-r border-b' :
                position === 'bottom' ? 'bottom-full -mb-1 left-1/2 -translate-x-1/2 border-l border-t' :
                position === 'left' ? 'left-full -ml-1 top-1/2 -translate-y-1/2 border-t border-r' :
                'right-full -mr-1 top-1/2 -translate-y-1/2 border-b border-l'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * File upload area component
 */
const FileUploadArea: React.FC<{
  files: File[];
  onFilesAdded: (files: File[]) => void;
  onFileRemoved: (index: number) => void;
  isProcessing: boolean;
}> = ({ files, onFilesAdded, onFileRemoved, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    onFilesAdded(droppedFiles);
  }, [onFilesAdded]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      onFilesAdded(selectedFiles);
      e.target.value = ''; // Reset input
    }
  }, [onFilesAdded]);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return ImageIcon;
    if (file.type === 'application/pdf') return File;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-2">
      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.ts,.tsx,.jsx,.py,.cpp,.c,.java"
      />

      {/* Drop area */}
      {isDragOver && (
        <div
          className="absolute inset-0 bg-sakura-500/20 border-2 border-dashed border-sakura-500 rounded-xl flex items-center justify-center z-20"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload className="w-8 h-8 text-sakura-500 mx-auto mb-2" />
            <p className="text-sakura-600 dark:text-sakura-400 font-medium">
              Drop files here to upload
            </p>
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {files.map((file, index) => {
            const IconComponent = getFileIcon(file);
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
              >
                <IconComponent className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </span>
                {!isProcessing && (
                  <button
                    onClick={() => onFileRemoved(index)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Provider selector component
 */
const ProviderSelector: React.FC<{
  providers: ClaraProvider[];
  selectedProvider: string;
  onProviderChange: (providerId: string) => void;
  isLoading?: boolean;
}> = ({ providers, selectedProvider, onProviderChange, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedProviderObj = providers.find(p => p.id === selectedProvider);

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'ollama': return Server;
      case 'openai': return Bot;
      case 'openrouter': return Zap;
      default: return Server;
    }
  };

  const getStatusColor = (provider: ClaraProvider) => {
    if (!provider.isEnabled) return 'text-gray-400';
    if (provider.isPrimary) return 'text-green-500';
    return 'text-blue-500';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors border border-gray-300 dark:border-gray-600 min-w-[180px] justify-between"
      >
        <div className="flex items-center gap-2">
          {selectedProviderObj && (
            <>
              {React.createElement(getProviderIcon(selectedProviderObj.type), {
                className: `w-4 h-4 ${getStatusColor(selectedProviderObj)}`
              })}
              <span className="text-gray-700 dark:text-gray-300 truncate">
                {selectedProviderObj.name}
              </span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {providers.map((provider) => {
            const IconComponent = getProviderIcon(provider.type);
            return (
              <button
                key={provider.id}
                onClick={() => {
                  onProviderChange(provider.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  provider.id === selectedProvider ? 'bg-sakura-50 dark:bg-sakura-900/20' : ''
                }`}
                disabled={!provider.isEnabled}
              >
                <IconComponent className={`w-4 h-4 ${getStatusColor(provider)}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {provider.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {provider.baseUrl}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {provider.isPrimary && (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  )}
                  {!provider.isEnabled && (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Model selector component
 */
const ModelSelector: React.FC<{
  models: ClaraModel[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  modelType?: 'text' | 'vision' | 'code';
  currentProvider?: string;
  isLoading?: boolean;
}> = ({ models, selectedModel, onModelChange, modelType = 'text', currentProvider, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Filter models by provider first, then by type and capability
  const filteredModels = models.filter(model => {
    // First filter by current provider
    if (currentProvider && model.provider !== currentProvider) {
      return false;
    }
    
    // Then filter by capability
    if (modelType === 'vision') return model.supportsVision;
    if (modelType === 'code') return model.supportsCode;
    return model.type === 'text' || model.type === 'multimodal';
  });

  const selectedModelObj = filteredModels.find(m => m.id === selectedModel);

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'vision': return ImageIcon;
      case 'code': return Zap;
      default: return Bot;
    }
  };

  const getModelTypeColor = (model: ClaraModel) => {
    if (model.type === 'vision' || model.supportsVision) return 'text-purple-500';
    if (model.type === 'code' || model.supportsCode) return 'text-blue-500';
    if (model.supportsTools) return 'text-green-500';
    return 'text-gray-500';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || filteredModels.length === 0}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors border border-gray-300 dark:border-gray-600 min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2">
          {selectedModelObj ? (
            <>
              {React.createElement(getModelTypeIcon(modelType), {
                className: `w-4 h-4 ${getModelTypeColor(selectedModelObj)}`
              })}
              <span className="text-gray-700 dark:text-gray-300 truncate">
                {selectedModelObj.name}
              </span>
            </>
          ) : (
            <>
              <Bot className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500 dark:text-gray-400">
                {filteredModels.length === 0 ? 'No models available' : 'Select model'}
              </span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && filteredModels.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {filteredModels.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                model.id === selectedModel ? 'bg-sakura-50 dark:bg-sakura-900/20' : ''
              }`}
            >
              {React.createElement(getModelTypeIcon(modelType), {
                className: `w-4 h-4 ${getModelTypeColor(model)}`
              })}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {model.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{model.provider}</span>
                  {model.supportsVision && <span>• Vision</span>}
                  {model.supportsCode && <span>• Code</span>}
                  {model.supportsTools && <span>• Tools</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Advanced options panel
 */
const AdvancedOptions: React.FC<{
  aiConfig?: ClaraAIConfig;
  onConfigChange?: (config: Partial<ClaraAIConfig>) => void;
  providers: ClaraProvider[];
  models: ClaraModel[];
  onProviderChange?: (providerId: string) => void;
  onModelChange?: (modelId: string, type: 'text' | 'vision' | 'code') => void;
  show: boolean;
}> = ({ aiConfig, onConfigChange, providers, models, onProviderChange, onModelChange, show }) => {
  const [mcpServers, setMcpServers] = useState<ClaraMCPServer[]>([]);
  const [isLoadingMcpServers, setIsLoadingMcpServers] = useState(false);

  // Load MCP servers when component mounts or when MCP is enabled
  useEffect(() => {
    const loadMcpServers = async () => {
      if (!aiConfig?.features.enableMCP) return;
      
      setIsLoadingMcpServers(true);
      try {
        await claraMCPService.refreshServers();
        const servers = claraMCPService.getRunningServers();
        setMcpServers(servers);
      } catch (error) {
        console.error('Failed to load MCP servers:', error);
      } finally {
        setIsLoadingMcpServers(false);
      }
    };

    loadMcpServers();
  }, [aiConfig?.features.enableMCP]);

  if (!show || !aiConfig) return null;

  const handleParameterChange = (key: string, value: any) => {
    onConfigChange?.({
      parameters: {
        ...aiConfig.parameters,
        [key]: value
      }
    });
  };

  const handleFeatureChange = (key: string, value: boolean) => {
    onConfigChange?.({
      features: {
        ...aiConfig.features,
        [key]: value
      }
    });
  };

  const handleMcpConfigChange = (key: string, value: any) => {
    const currentMcp = aiConfig.mcp || {
      enableTools: true,
      enableResources: true,
      enabledServers: [],
      autoDiscoverTools: true,
      maxToolCalls: 5
    };
    
    onConfigChange?.({
      mcp: {
        ...currentMcp,
        [key]: value
      }
    });
  };

  const handleMcpServerToggle = (serverName: string, enabled: boolean) => {
    const currentServers = aiConfig.mcp?.enabledServers || [];
    const updatedServers = enabled
      ? [...currentServers, serverName]
      : currentServers.filter(name => name !== serverName);
    
    handleMcpConfigChange('enabledServers', updatedServers);
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-4">
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          AI Provider
        </label>
        <ProviderSelector
          providers={providers}
          selectedProvider={aiConfig.provider}
          onProviderChange={(providerId) => {
            onConfigChange?.({ provider: providerId });
            onProviderChange?.(providerId);
          }}
        />
      </div>

      {/* Model Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Text Model
          </label>
          <ModelSelector
            models={models}
            selectedModel={aiConfig.models.text || ''}
            onModelChange={(modelId) => {
              onConfigChange?.({
                models: { ...aiConfig.models, text: modelId }
              });
              onModelChange?.(modelId, 'text');
            }}
            modelType="text"
            currentProvider={aiConfig.provider}
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Vision Model
          </label>
          <ModelSelector
            models={models}
            selectedModel={aiConfig.models.vision || ''}
            onModelChange={(modelId) => {
              onConfigChange?.({
                models: { ...aiConfig.models, vision: modelId }
              });
              onModelChange?.(modelId, 'vision');
            }}
            modelType="vision"
            currentProvider={aiConfig.provider}
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Code Model
          </label>
          <ModelSelector
            models={models}
            selectedModel={aiConfig.models.code || ''}
            onModelChange={(modelId) => {
              onConfigChange?.({
                models: { ...aiConfig.models, code: modelId }
              });
              onModelChange?.(modelId, 'code');
            }}
            modelType="code"
            currentProvider={aiConfig.provider}
          />
        </div>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Temperature: {aiConfig.parameters.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={aiConfig.parameters.temperature}
            onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Max Tokens
          </label>
          <input
            type="number"
            min="100"
            max="8000"
            value={aiConfig.parameters.maxTokens}
            onChange={(e) => handleParameterChange('maxTokens', parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
          />
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={aiConfig.features.enableTools}
            onChange={(e) => handleFeatureChange('enableTools', e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600 dark:text-gray-400">Enable Tools</span>
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={aiConfig.features.enableRAG}
            onChange={(e) => handleFeatureChange('enableRAG', e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600 dark:text-gray-400">Enable RAG</span>
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={aiConfig.features.enableStreaming}
            onChange={(e) => handleFeatureChange('enableStreaming', e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600 dark:text-gray-400">Enable Streaming</span>
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={aiConfig.features.autoModelSelection}
            onChange={(e) => handleFeatureChange('autoModelSelection', e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600 dark:text-gray-400">Auto Model Selection</span>
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={aiConfig.features.enableMCP || false}
            onChange={(e) => handleFeatureChange('enableMCP', e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Server className="w-3 h-3" />
            Enable MCP
          </span>
        </label>
      </div>

      {/* MCP Configuration */}
      {aiConfig.features.enableMCP && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-sakura-500" />
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              MCP Configuration
            </h4>
            {isLoadingMcpServers && (
              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            )}
          </div>

          {/* MCP Features */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={aiConfig.mcp?.enableTools ?? true}
                onChange={(e) => handleMcpConfigChange('enableTools', e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-600 dark:text-gray-400">MCP Tools</span>
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={aiConfig.mcp?.enableResources ?? true}
                onChange={(e) => handleMcpConfigChange('enableResources', e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-600 dark:text-gray-400">MCP Resources</span>
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={aiConfig.mcp?.autoDiscoverTools ?? true}
                onChange={(e) => handleMcpConfigChange('autoDiscoverTools', e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-600 dark:text-gray-400">Auto Discover</span>
            </label>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Max Tool Calls: {aiConfig.mcp?.maxToolCalls ?? 5}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={aiConfig.mcp?.maxToolCalls ?? 5}
                onChange={(e) => handleMcpConfigChange('maxToolCalls', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* MCP Servers */}
          {mcpServers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Available MCP Servers ({mcpServers.length})
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {mcpServers.map((server) => {
                  const isEnabled = aiConfig.mcp?.enabledServers?.includes(server.name) ?? false;
                  return (
                    <div key={server.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          server.isRunning ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className="font-medium">{server.name}</span>
                        <span className="text-gray-500">({server.status})</span>
                      </div>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => handleMcpServerToggle(server.name, e.target.checked)}
                          disabled={!server.isRunning}
                          className="rounded"
                        />
                        <span className="text-gray-600 dark:text-gray-400">Enable</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mcpServers.length === 0 && !isLoadingMcpServers && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              No MCP servers available. Configure servers in Settings.
            </div>
          )}
        </div>
      )}

      {/* Autonomous Agent Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-sakura-500" />
            Autonomous Agent
          </h4>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiConfig?.autonomousAgent?.enabled || false}
              onChange={(e) => {
                const currentAutonomousAgent = aiConfig?.autonomousAgent || {
                  enabled: false,
                  maxRetries: 3,
                  retryDelay: 1000,
                  enableSelfCorrection: true,
                  enableToolGuidance: true,
                  enableProgressTracking: true,
                  maxToolCalls: 10,
                  confidenceThreshold: 0.8,
                  enableChainOfThought: false,
                  enableErrorLearning: true
                };
                
                onConfigChange?.({
                  autonomousAgent: {
                    ...currentAutonomousAgent,
                    enabled: e.target.checked
                  }
                });
              }}
              className="sr-only"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${
              aiConfig?.autonomousAgent?.enabled 
                ? 'bg-sakura-500' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                aiConfig?.autonomousAgent?.enabled ? 'translate-x-5' : 'translate-x-0'
              } mt-0.5 ml-0.5`} />
            </div>
          </label>
        </div>

        {aiConfig?.autonomousAgent?.enabled && (
          <div className="space-y-3 pl-6 border-l-2 border-sakura-200 dark:border-sakura-800">
            {/* Max Retries */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Retries: {aiConfig?.autonomousAgent?.maxRetries || 3}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={aiConfig?.autonomousAgent?.maxRetries || 3}
                onChange={(e) => {
                  const currentAutonomousAgent = aiConfig?.autonomousAgent || {
                    enabled: true,
                    maxRetries: 3,
                    retryDelay: 1000,
                    enableSelfCorrection: true,
                    enableToolGuidance: true,
                    enableProgressTracking: true,
                    maxToolCalls: 10,
                    confidenceThreshold: 0.8,
                    enableChainOfThought: false,
                    enableErrorLearning: true
                  };
                  
                  onConfigChange?.({
                    autonomousAgent: {
                      ...currentAutonomousAgent,
                      maxRetries: parseInt(e.target.value)
                    }
                  });
                }}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Max Tool Calls */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Tool Calls: {aiConfig?.autonomousAgent?.maxToolCalls || 10}
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={aiConfig?.autonomousAgent?.maxToolCalls || 10}
                onChange={(e) => {
                  const currentAutonomousAgent = aiConfig?.autonomousAgent || {
                    enabled: true,
                    maxRetries: 3,
                    retryDelay: 1000,
                    enableSelfCorrection: true,
                    enableToolGuidance: true,
                    enableProgressTracking: true,
                    maxToolCalls: 10,
                    confidenceThreshold: 0.8,
                    enableChainOfThought: false,
                    enableErrorLearning: true
                  };
                  
                  onConfigChange?.({
                    autonomousAgent: {
                      ...currentAutonomousAgent,
                      maxToolCalls: parseInt(e.target.value)
                    }
                  });
                }}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Agent Features */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={aiConfig?.autonomousAgent?.enableSelfCorrection || false}
                  onChange={(e) => {
                    const currentAutonomousAgent = aiConfig?.autonomousAgent || {
                      enabled: true,
                      maxRetries: 3,
                      retryDelay: 1000,
                      enableSelfCorrection: true,
                      enableToolGuidance: true,
                      enableProgressTracking: true,
                      maxToolCalls: 10,
                      confidenceThreshold: 0.8,
                      enableChainOfThought: false,
                      enableErrorLearning: true
                    };
                    
                    onConfigChange?.({
                      autonomousAgent: {
                        ...currentAutonomousAgent,
                        enableSelfCorrection: e.target.checked
                      }
                    });
                  }}
                  className="w-3 h-3 text-sakura-500 rounded border-gray-300 focus:ring-sakura-500"
                />
                Self-Correction
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={aiConfig?.autonomousAgent?.enableProgressTracking || false}
                  onChange={(e) => {
                    const currentAutonomousAgent = aiConfig?.autonomousAgent || {
                      enabled: true,
                      maxRetries: 3,
                      retryDelay: 1000,
                      enableSelfCorrection: true,
                      enableToolGuidance: true,
                      enableProgressTracking: true,
                      maxToolCalls: 10,
                      confidenceThreshold: 0.8,
                      enableChainOfThought: false,
                      enableErrorLearning: true
                    };
                    
                    onConfigChange?.({
                      autonomousAgent: {
                        ...currentAutonomousAgent,
                        enableProgressTracking: e.target.checked
                      }
                    });
                  }}
                  className="w-3 h-3 text-sakura-500 rounded border-gray-300 focus:ring-sakura-500"
                />
                Progress Tracking
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={aiConfig?.autonomousAgent?.enableChainOfThought || false}
                  onChange={(e) => {
                    const currentAutonomousAgent = aiConfig?.autonomousAgent || {
                      enabled: true,
                      maxRetries: 3,
                      retryDelay: 1000,
                      enableSelfCorrection: true,
                      enableToolGuidance: true,
                      enableProgressTracking: true,
                      maxToolCalls: 10,
                      confidenceThreshold: 0.8,
                      enableChainOfThought: false,
                      enableErrorLearning: true
                    };
                    
                    onConfigChange?.({
                      autonomousAgent: {
                        ...currentAutonomousAgent,
                        enableChainOfThought: e.target.checked
                      }
                    });
                  }}
                  className="w-3 h-3 text-sakura-500 rounded border-gray-300 focus:ring-sakura-500"
                />
                Chain of Thought
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Main Clara Input Component
 */
const ClaraAssistantInput: React.FC<ClaraInputProps> = ({
  onSendMessage,
  isLoading = false,
  onStop,
  onNewChat,
  showAdvancedOptions = false,
  sessionConfig,
  onConfigChange,
  providers = [],
  models = [],
  onProviderChange,
  onModelChange
}) => {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedOptions);
  const [dragCounter, setDragCounter] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default AI config if not provided
  const defaultAIConfig: ClaraAIConfig = {
    models: {
      text: sessionConfig?.aiConfig?.models.text || '',
      vision: sessionConfig?.aiConfig?.models.vision || '',
      code: sessionConfig?.aiConfig?.models.code || ''
    },
    provider: sessionConfig?.aiConfig?.provider || (providers.find(p => p.isPrimary)?.id || ''),
    parameters: {
      temperature: sessionConfig?.aiConfig?.parameters.temperature || sessionConfig?.temperature || 0.7,
      maxTokens: sessionConfig?.aiConfig?.parameters.maxTokens || sessionConfig?.maxTokens || 1000,
      topP: sessionConfig?.aiConfig?.parameters.topP || 1.0,
      topK: sessionConfig?.aiConfig?.parameters.topK || 40
    },
    features: {
      enableTools: sessionConfig?.aiConfig?.features.enableTools ?? sessionConfig?.enableTools ?? true,
      enableRAG: sessionConfig?.aiConfig?.features.enableRAG ?? sessionConfig?.enableRAG ?? false,
      enableStreaming: sessionConfig?.aiConfig?.features.enableStreaming ?? true,
      enableVision: sessionConfig?.aiConfig?.features.enableVision ?? true,
      autoModelSelection: sessionConfig?.aiConfig?.features.autoModelSelection ?? true,
      enableMCP: sessionConfig?.aiConfig?.features.enableMCP ?? true
    }
  };

  const currentAIConfig = sessionConfig?.aiConfig || defaultAIConfig;

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // File handling
  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleFileRemoved = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Drag and drop for entire component
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(prev => prev + 1);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(prev => prev - 1);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(0);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(Array.from(e.dataTransfer.files));
      }
    };

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDrop);
    };
  }, [handleFilesAdded]);

  // Convert File objects to ClaraFileAttachment with proper file reading
  const convertFilesToAttachments = useCallback(async (files: File[]): Promise<ClaraFileAttachment[]> => {
    const getFileType = (file: File): ClaraFileType => {
      if (file.type.startsWith('image/')) return 'image';
      if (file.type === 'application/pdf') return 'pdf';
      if (['.js', '.ts', '.tsx', '.jsx', '.py', '.cpp', '.c', '.java'].some(ext => file.name.endsWith(ext))) return 'code';
      if (['.json'].some(ext => file.name.endsWith(ext))) return 'json';
      if (['.csv'].some(ext => file.name.endsWith(ext))) return 'csv';
      if (['.md', '.txt', '.markdown'].some(ext => file.name.endsWith(ext))) return 'text';
      return 'document';
    };

    const readFileAsBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result && typeof reader.result === 'string') {
            // Extract just the base64 part (after the comma)
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    };

    const readFileAsText = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result && typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read file as text'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    };

    const attachments: ClaraFileAttachment[] = [];
    
    // PDF processing functions
    const extractTextFromPDF = async (file: File): Promise<string> => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        const numPages = pdf.numPages;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
        }
        
        return fullText.trim();
      } catch (error) {
        console.error('Failed to extract text from PDF:', error);
        throw error;
      }
    };

    const convertPDFToImages = async (file: File, maxPages: number = 3): Promise<string[]> => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const images: string[] = [];
        const numPages = Math.min(pdf.numPages, maxPages); // Limit to avoid too many images
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 }); // Good balance of quality and size
          
          // Create canvas
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Render page to canvas
          await page.render({
            canvasContext: context!,
            viewport: viewport
          }).promise;
          
          // Convert canvas to base64 image
          const imageDataUrl = canvas.toDataURL('image/png');
          const base64 = imageDataUrl.split(',')[1]; // Remove data:image/png;base64, prefix
          images.push(base64);
        }
        
        return images;
      } catch (error) {
        console.error('Failed to convert PDF to images:', error);
        throw error;
      }
    };
    
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const fileType = getFileType(file);
      
      try {
        let base64: string | undefined;
        let extractedText: string | undefined;
        
        // Handle different file types appropriately
        if (fileType === 'image') {
          // For images, convert to base64 for vision models
          base64 = await readFileAsBase64(file);
        } else if (fileType === 'text' || fileType === 'code' || fileType === 'json' || fileType === 'csv') {
          // For text-based files, read as text content
          extractedText = await readFileAsText(file);
        } else if (fileType === 'pdf') {
          // For PDFs, try to extract text first, then fallback to converting to images
          try {
            extractedText = await extractTextFromPDF(file);
            console.log(`Successfully extracted text from PDF: ${file.name}`);
          } catch (textError) {
            console.warn(`Could not extract text from PDF, converting to images: ${textError}`);
            try {
              // Convert PDF to images as fallback
              const pdfImages = await convertPDFToImages(file);
              if (pdfImages.length > 0) {
                // Create multiple image attachments for each page
                for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
                  const pageAttachment: ClaraFileAttachment = {
                    id: `file-${Date.now()}-${index}-page-${pageIndex + 1}`,
                    name: `${file.name} - Page ${pageIndex + 1}`,
                    type: 'image',
                    size: file.size / pdfImages.length, // Approximate size per page
                    mimeType: 'image/png',
                    base64: pdfImages[pageIndex],
                    processed: true,
                    processingResult: {
                      success: true,
                      metadata: {
                        originalFile: file.name,
                        pageNumber: pageIndex + 1,
                        totalPages: pdfImages.length,
                        convertedFromPDF: true
                      }
                    }
                  };
                  attachments.push(pageAttachment);
                }
                continue; // Skip the main attachment creation since we added page attachments
              }
            } catch (imageError) {
              console.error(`Failed to convert PDF to images: ${imageError}`);
              // Fall back to base64 as last resort (though this likely won't be useful)
              base64 = await readFileAsBase64(file);
            }
          }
        } else {
          // For other document types, read as base64
          base64 = await readFileAsBase64(file);
        }

        const attachment: ClaraFileAttachment = {
          id: `file-${Date.now()}-${index}`,
          name: file.name,
          type: fileType,
          size: file.size,
          mimeType: file.type,
          base64: base64,
          processed: true,
          processingResult: {
            success: true,
            extractedText: extractedText,
            metadata: {
              readAsText: !!extractedText,
              readAsBase64: !!base64
            }
          }
        };

        attachments.push(attachment);
      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
        
        // Create attachment without content if reading fails
        const attachment: ClaraFileAttachment = {
          id: `file-${Date.now()}-${index}`,
          name: file.name,
          type: fileType,
          size: file.size,
          mimeType: file.type,
          processed: false,
          processingResult: {
            success: false,
            error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        };
        
        attachments.push(attachment);
      }
    }
    
    return attachments;
  }, []);

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() && files.length === 0) return;
    
    let attachments: ClaraFileAttachment[] | undefined;
    let enhancedPrompt = input; // For AI processing
    let displayAttachments: ClaraFileAttachment[] = []; // For UI display
    
    if (files.length > 0) {
      try {
        attachments = await convertFilesToAttachments(files);
        console.log('Converted attachments:', attachments);
        
        // Extract text content from attachments and inject as context for AI
        const textContents: string[] = [];
        const imageAttachments: ClaraFileAttachment[] = [];
        
        attachments.forEach(attachment => {
          // Create display-friendly attachment info
          if (attachment.processingResult?.extractedText || attachment.type !== 'image') {
            displayAttachments.push({
              ...attachment,
              // Clean up the attachment for display - remove large base64 data
              base64: undefined,
              processingResult: attachment.processingResult ? {
                ...attachment.processingResult,
                success: attachment.processingResult.success ?? false,
                extractedText: attachment.processingResult?.extractedText ? '[Text content extracted]' : undefined
              } : undefined
            });
          }
          
          if (attachment.processingResult?.extractedText) {
            // Add text content as context for AI (not for display)
            textContents.push(`--- Content from ${attachment.name} ---\n${attachment.processingResult.extractedText}\n--- End of ${attachment.name} ---\n`);
          }
          
          // Keep image attachments for vision models (including PDF pages converted to images)
          if (attachment.type === 'image' && attachment.base64) {
            imageAttachments.push(attachment);
            // Also add to display attachments if it's a regular image
            if (!attachment.processingResult?.metadata?.convertedFromPDF) {
              displayAttachments.push({
                ...attachment,
                base64: undefined, // Don't include base64 in display
                processingResult: attachment.processingResult ? {
                  ...attachment.processingResult,
                  success: attachment.processingResult.success ?? false,
                  extractedText: '[Image attachment]'
                } : undefined
              });
            }
          }
        });
        
        // If we have text content, enhance the prompt for AI processing but keep original for display
        if (textContents.length > 0) {
          const contextText = textContents.join('\n');
          enhancedPrompt = `${contextText}\n\nUser Question: ${input}`;
          console.log('Enhanced prompt with file context for AI processing');
        }
        
        // Only pass image attachments to the API (text content is now in the enhanced prompt)
        attachments = imageAttachments.length > 0 ? imageAttachments : undefined;
        
      } catch (error) {
        console.error('Failed to convert files to attachments:', error);
        // Continue without attachments rather than failing completely
        attachments = undefined;
      }
    }
    
    // Send enhanced prompt to AI for processing, but original input for display
    // Store the original input and display attachments in the enhanced prompt metadata
    if (displayAttachments.length > 0) {
      // Create a special metadata comment that can be parsed later for display
      const displayInfo = `[DISPLAY_META:${JSON.stringify({
        originalMessage: input,
        displayAttachments: displayAttachments.map(att => ({
          id: att.id,
          name: att.name,
          type: att.type,
          size: att.size,
          processed: att.processed
        }))
      })}]`;
      enhancedPrompt = `${displayInfo}\n\n${enhancedPrompt}`;
    }
    
    onSendMessage(enhancedPrompt, attachments);
    
    // Reset state
    setInput('');
    setFiles([]);
    adjustTextareaHeight();
  }, [input, files, onSendMessage, convertFilesToAttachments, adjustTextareaHeight]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Quick action handlers
  const handleNewChat = useCallback(() => {
    setInput('');
    setFiles([]);
    onNewChat?.();
  }, [onNewChat]);

  const triggerImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        handleFilesAdded(Array.from(target.files));
      }
    };
    input.click();
  }, [handleFilesAdded]);

  const triggerDocumentUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.txt,.md,.json,.csv,.js,.ts,.tsx,.jsx,.py,.cpp,.c,.java';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        handleFilesAdded(Array.from(target.files));
      }
    };
    input.click();
  }, [handleFilesAdded]);

  // Handle AI config changes
  const handleAIConfigChange = useCallback((newConfig: Partial<ClaraAIConfig>) => {
    // Ensure we have proper defaults for all required fields
    const defaultMcp = {
      enableTools: true,
      enableResources: true,
      enabledServers: [],
      autoDiscoverTools: true,
      maxToolCalls: 5
    };

    const defaultAutonomousAgent = {
      enabled: false,
      maxRetries: 3,
      retryDelay: 1000,
      enableSelfCorrection: true,
      enableToolGuidance: true,
      enableProgressTracking: true,
      maxToolCalls: 10,
      confidenceThreshold: 0.8,
      enableChainOfThought: false,
      enableErrorLearning: true
    };

    const updatedConfig: ClaraAIConfig = {
      ...currentAIConfig,
      ...newConfig,
      parameters: {
        ...currentAIConfig.parameters,
        ...newConfig.parameters
      },
      features: {
        ...currentAIConfig.features,
        ...newConfig.features
      },
      models: {
        ...currentAIConfig.models,
        ...newConfig.models
      },
      mcp: {
        ...defaultMcp,
        ...currentAIConfig.mcp,
        ...newConfig.mcp
      },
      autonomousAgent: {
        ...defaultAutonomousAgent,
        ...currentAIConfig.autonomousAgent,
        ...newConfig.autonomousAgent
      }
    };

    onConfigChange?.({
      aiConfig: updatedConfig,
      // Legacy support
      temperature: updatedConfig.parameters.temperature,
      maxTokens: updatedConfig.parameters.maxTokens,
      enableTools: updatedConfig.features.enableTools,
      enableRAG: updatedConfig.features.enableRAG
    });
  }, [currentAIConfig, onConfigChange]);

  // Get current selected model for display
  const getCurrentModel = () => {
    if (currentAIConfig.features.autoModelSelection) {
      return 'Auto Mode';
    }
    
    const textModel = models.find(m => m.id === currentAIConfig.models.text);
    return textModel?.name || 'No model selected';
  };

  return (
    <div 
      ref={containerRef}
      className="relative dark:border-gray-800 bg-transparent transition-colors duration-100 z-10"
    >
      {/* Drag overlay */}
      {dragCounter > 0 && (
        <div className="absolute inset-0 bg-sakura-500/10 border-2 border-dashed border-sakura-500 rounded-xl z-30 pointer-events-none" />
      )}

      <div className="max-w-4xl mx-auto">
        <div className="p-6 flex justify-center">
          <div className="max-w-3xl w-full relative">
            {/* Main Input Container */}
            <div className="glassmorphic rounded-xl p-4 bg-white/60 dark:bg-gray-900/40 backdrop-blur-md shadow-lg transition-all duration-300">
              
              {/* File Upload Area */}
              <FileUploadArea
                files={files}
                onFilesAdded={handleFilesAdded}
                onFileRemoved={handleFileRemoved}
                isProcessing={isLoading}
              />

              {/* Input Field */}
              <div className={files.length > 0 ? 'mt-3' : ''}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="w-full border-0 outline-none focus:outline-none focus:ring-0 resize-none bg-transparent text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
                  style={{
                    height: 'auto',
                    minHeight: '24px',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    padding: '0',
                    borderRadius: '0'
                  }}
                  disabled={isLoading}
                />
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-between items-center mt-4">
                {/* Left Side Actions */}
                <div className="flex items-center gap-2">
                  {/* New Chat Button */}
                  <Tooltip content="Start a new conversation" position="top">
                    <button
                      onClick={handleNewChat}
                      className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                      disabled={isLoading}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </Tooltip>
                  
                  {/* Image Upload Button */}
                  <Tooltip content="Upload images for analysis" position="top">
                    <button 
                      onClick={triggerImageUpload}
                      className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                      disabled={isLoading}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </Tooltip>

                  {/* Document Upload Button */}
                  <Tooltip content="Upload documents, PDFs, and code files" position="top">
                    <button
                      onClick={triggerDocumentUpload}
                      className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                      disabled={isLoading}
                    >
                      <File className="w-5 h-5" />
                    </button>
                  </Tooltip>

                  {/* Advanced Settings Toggle */}
                  <Tooltip content="Configure AI models and parameters" position="top">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className={`group p-2 rounded-lg transition-colors relative ${
                        showAdvanced 
                          ? 'bg-sakura-100 dark:bg-sakura-100/20 text-sakura-600 dark:text-sakura-400' 
                          : 'hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </Tooltip>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                  {/* MCP Status Indicator */}
                  {currentAIConfig.features.enableMCP && (
                    <Tooltip content={`MCP enabled with ${currentAIConfig.mcp?.enabledServers?.length || 0} servers`} position="top">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-600">
                        <Server className="w-3 h-3" />
                        <span>MCP</span>
                        {currentAIConfig.mcp?.enabledServers?.length && (
                          <span className="bg-green-200 dark:bg-green-800 px-1 rounded text-xs">
                            {currentAIConfig.mcp.enabledServers.length}
                          </span>
                        )}
                      </div>
                    </Tooltip>
                  )}

                  {/* Model/Provider Selection */}
                  <div className="relative">
                    {currentAIConfig.features.autoModelSelection ? (
                      <Tooltip content="Automatic model selection enabled" position="top">
                        <button
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors border border-blue-300 dark:border-blue-600"
                          disabled={isLoading}
                        >
                          <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-gray-700 dark:text-gray-300">
                            Auto Mode
                          </span>
                          <Zap className="w-3 h-3 text-blue-500" />
                        </button>
                      </Tooltip>
                    ) : (
                      <ModelSelector
                        models={models}
                        selectedModel={currentAIConfig.models.text || ''}
                        onModelChange={(modelId) => {
                          handleAIConfigChange({
                            models: { ...currentAIConfig.models, text: modelId }
                          });
                          onModelChange?.(modelId, 'text');
                        }}
                        modelType="text"
                        currentProvider={currentAIConfig.provider}
                        isLoading={isLoading}
                      />
                    )}
                  </div>

                  {/* Send Button */}
                  {isLoading ? (
                    <Tooltip content="Stop generating response" position="top">
                      <button
                        className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        onClick={onStop}
                        disabled={!onStop}
                      >
                        <Square className="w-4 h-4" fill="white" />
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip content="Send message (Enter)" position="top">
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() && files.length === 0}
                        className="p-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            {/* Advanced Options */}
            <AdvancedOptions
              aiConfig={currentAIConfig}
              onConfigChange={handleAIConfigChange}
              providers={providers}
              models={models}
              onProviderChange={onProviderChange}
              onModelChange={onModelChange}
              show={showAdvanced}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaraAssistantInput; 