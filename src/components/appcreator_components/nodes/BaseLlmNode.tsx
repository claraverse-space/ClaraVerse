import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { useOllama } from '../../../context/OllamaContext';
import { Settings, RefreshCw, Activity, Database } from 'lucide-react';
import { db } from '../../../db';
import { OllamaClient } from '../../../utils/OllamaClient';

const BaseLlmNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const { baseUrl } = useOllama();

  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  // Basic settings
  const [model, setModel] = useState(data.config.model || '');
  const [prompt, setPrompt] = useState(data.config.prompt || '');
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState(data.config.ollamaUrl || '');
  
  // Model lists and loading state
  const [ollamaModels, setOllamaModels] = useState<any[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [nodeError, setNodeError] = useState<string | null>(null);

  // API selection settings
  const [apiType, setApiType] = useState<'ollama' | 'openai'>(data.config.apiType || 'ollama');
  const [openaiApiKey, setOpenaiApiKey] = useState(data.config.apiKey || '');
  const [openaiUrl, setOpenaiUrl] = useState(data.config.openaiUrl || 'https://api.openai.com/v1');
  const [openaiModels, setOpenaiModels] = useState<string[]>([
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ]);

  // Initialize configuration on mount
  useEffect(() => {
    const loadApiConfig = async () => {
      try {
        const config = await db.getAPIConfig();
        
        // Set API type from global config if available
        if (config?.api_type && !data.config.apiType) {
          setApiType(config.api_type as 'ollama' | 'openai');
          data.config.apiType = config.api_type;
        }
        
        // Set Ollama URL
        const configuredUrl = config?.ollama_base_url || baseUrl || 'http://localhost:11434';
        if (!data.config.ollamaUrl) {
          data.config.ollamaUrl = configuredUrl;
          setCustomUrl(configuredUrl);
        }
        
        // Set OpenAI config if available
        if (config?.openai_api_key && !data.config.apiKey) {
          setOpenaiApiKey(config.openai_api_key);
          data.config.apiKey = config.openai_api_key;
        }
        
        if (config?.openai_base_url && !data.config.openaiUrl) {
          setOpenaiUrl(config.openai_base_url);
          data.config.openaiUrl = config.openai_base_url;
        }
      } catch (error) {
        console.error("Failed to load API configuration:", error);
        if (!data.config.ollamaUrl) {
          data.config.ollamaUrl = baseUrl || 'http://localhost:11434';
          setCustomUrl(baseUrl || 'http://localhost:11434');
        }
      }
    };
    
    loadApiConfig();
  }, [baseUrl, data]);
  
  // Fetch models based on selected API type
  const fetchModels = async () => {
    setNodeLoading(true);
    setNodeError(null);
    
    try {
      if (apiType === 'ollama') {
        // Fetch Ollama models
        const url = customUrl || 'http://localhost:11434';
        const response = await fetch(`${url}/api/tags`);
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const json = await response.json();
        setOllamaModels(json.models || []);
        
        // Set first model if none selected
        if (json.models?.length > 0 && !model) {
          const firstModel = json.models[0]?.name;
          if (firstModel) {
            setModel(firstModel);
            data.config.model = firstModel;
          }
        }
      } else {
        // For OpenAI, use the client to fetch models if API key is provided
        if (openaiApiKey) {
          try {
            const client = new OllamaClient(openaiUrl, {
              apiKey: openaiApiKey,
              type: 'openai'
            });
            const models = await client.listModels();
            
            // Don't filter by name for non-OpenAI endpoints to support LM Studio and similar services
            const isStandardOpenAI = openaiUrl.includes('api.openai.com');
            const chatModels = models
              .map((m: any) => m.name || m.id)
              .filter((name: string) => {
                // Only filter if using official OpenAI API
                if (isStandardOpenAI) {
                  const lowerName = name.toLowerCase();
                  return lowerName.includes('gpt') && !lowerName.includes('vision');
                }
                // Include all models for other endpoints
                return true;
              });
              
            setOpenaiModels(chatModels.length > 0 ? chatModels : openaiModels);
            console.log("Loaded models:", chatModels);
          } catch (error) {
            console.warn("Failed to fetch OpenAI models, using defaults:", error);
            setNodeError(`Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // If no model selected, set default
        if (!model || (apiType === 'openai' && !openaiModels.includes(model))) {
          const defaultModel = openaiModels[0] || 'gpt-3.5-turbo';
          setModel(defaultModel);
          data.config.model = defaultModel;
        }
      }
    } catch (error) {
      setNodeError(error instanceof Error ? error.message : 'Failed to fetch models');
    } finally {
      setNodeLoading(false);
    }
  };
  
  // Fetch models when apiType or URLs change
  useEffect(() => {
    fetchModels();
  }, [apiType, customUrl, openaiUrl, openaiApiKey]);
  
  // Update config when apiType changes
  useEffect(() => {
    data.config.apiType = apiType;
  }, [apiType, data.config]);
  
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setModel(e.target.value);
    data.config.model = e.target.value;
  };
  
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setPrompt(e.target.value);
    data.config.prompt = e.target.value;
  };
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setCustomUrl(e.target.value);
    data.config.ollamaUrl = e.target.value;
  };

  const handleApiTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setApiType(e.target.value as 'ollama' | 'openai');
    data.config.apiType = e.target.value;
  };
  
  const handleOpenAIKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setOpenaiApiKey(e.target.value);
    data.config.apiKey = e.target.value;
  };
  
  const handleOpenAIUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setOpenaiUrl(e.target.value);
    data.config.openaiUrl = e.target.value;
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchModels();
  };
  
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };
  
  const displayedModels = apiType === 'ollama' ? ollamaModels : openaiModels;
  
  return (
    <div 
      className={`p-3 rounded-lg border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } shadow-md w-72`}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <div className="flex items-center justify-between mb-2" onClick={stopPropagation}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm">{data.label}</div>
        </div>
        <button 
          onClick={handleSettingsClick}
          onMouseDown={stopPropagation}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700`}
        >
          <Settings size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
        </button>
      </div>
      
      {/* API Type Selection */}
      <div className="mb-2" onClick={stopPropagation} onMouseDown={stopPropagation}>
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          API Type
        </label>
        <select
          value={apiType}
          onChange={handleApiTypeChange}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-sm`}
        >
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      
      {showSettings && (
        <div className="mb-3 p-2 border border-dashed rounded" onClick={stopPropagation} onMouseDown={stopPropagation}>
          {apiType === 'ollama' ? (
            <>
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Ollama API URL
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={customUrl}
                  onChange={handleUrlChange}
                  onClick={stopPropagation}
                  onMouseDown={stopPropagation}
                  onKeyDown={stopPropagation}
                  onFocus={stopPropagation}
                  placeholder="http://localhost:11434"
                  className={`w-full p-2 rounded border ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                  } text-xs`}
                />
                <button 
                  onClick={handleRefreshClick}
                  onMouseDown={stopPropagation}
                  className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  disabled={nodeLoading}
                >
                  <RefreshCw size={16} className={nodeLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </>
          ) : (
            <>
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                OpenAI API Key
              </label>
              <input 
                type="password"
                value={openaiApiKey}
                onChange={handleOpenAIKeyChange}
                onClick={stopPropagation}
                onMouseDown={stopPropagation}
                onKeyDown={stopPropagation}
                onFocus={stopPropagation}
                placeholder="sk-..."
                className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-xs mb-2`}
              />
              
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                OpenAI API URL
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={openaiUrl}
                  onChange={handleOpenAIUrlChange}
                  onClick={stopPropagation}
                  onMouseDown={stopPropagation}
                  onKeyDown={stopPropagation}
                  onFocus={stopPropagation}
                  placeholder="https://api.openai.com/v1"
                  className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-xs`}
                />
                <button 
                  onClick={handleRefreshClick}
                  onMouseDown={stopPropagation}
                  className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  disabled={nodeLoading}
                >
                  <RefreshCw size={16} className={nodeLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
      
      <div className="mb-2" onClick={stopPropagation} onMouseDown={stopPropagation}>
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Select {apiType === 'ollama' ? 'LLM' : 'OpenAI'} Model
        </label>
        <div className="flex items-center gap-2">
          <select 
            value={model}
            onChange={handleModelChange}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            onKeyDown={stopPropagation}
            onFocus={stopPropagation}
            className={`w-full p-2 rounded border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            } text-sm pointer-events-auto`}
            disabled={nodeLoading}
          >
            {nodeLoading ? (
              <option>Loading models...</option>
            ) : nodeError ? (
              <option>Error loading models</option>
            ) : displayedModels.length === 0 ? (
              <option>No models available</option>
            ) : (
              apiType === 'ollama' ? (
                displayedModels.map((m: any) => (
                  <option 
                    key={m.name} 
                    value={m.name}
                  >
                    {m.name} ({Math.round(m.size / 1024 / 1024 / 1024)}GB)
                  </option>
                ))
              ) : (
                displayedModels.map((name: string) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              )
            )}
          </select>
          <button 
            onClick={handleRefreshClick}
            onMouseDown={stopPropagation}
            className="p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
            disabled={nodeLoading}
          >
            <RefreshCw size={14} className={nodeLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {nodeError && (
          <p className="text-xs text-red-500 mt-1">
            {nodeError}
          </p>
        )}
      </div>
      
      <div className="mb-2" onClick={stopPropagation} onMouseDown={stopPropagation}>
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          System Prompt
        </label>
        <textarea 
          value={prompt}
          onChange={handlePromptChange}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          onKeyDown={stopPropagation}
          onFocus={stopPropagation}
          placeholder="Enter system prompt..."
          className={`w-full p-2 rounded border ${
            isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
          } text-sm`}
          rows={3}
        />
      </div>
      
      {/* API provider info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
        <Database size={12} />
        <span>Using {apiType === 'ollama' ? 'Ollama' : 'OpenAI'} API</span>
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6 }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="text-out"
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

// Export metadata as a named export for NodeRegistry
export const metadata = {
  id: 'base_llm',
  name: 'LLM Prompt',
  description: 'Process text with an LLM',
  icon: Activity,
  color: 'bg-purple-500',
  bgColor: 'bg-purple-100',
  lightColor: '#8B5CF6',
  darkColor: '#A78BFA',
  category: 'process',
  inputs: ['text'],
  outputs: ['text'],
};

export default BaseLlmNode;
