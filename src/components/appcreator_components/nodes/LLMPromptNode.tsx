import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { useOllama } from '../../../context/OllamaContext';
import { Settings, RefreshCw, Activity } from 'lucide-react';
import { db } from '../../../db';

const LLMPromptNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const { baseUrl } = useOllama();

  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  const [model, setModel] = useState(data.config.model || '');
  const [prompt, setPrompt] = useState(data.config.prompt || '');
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState(data.config.ollamaUrl || '');
  
  const [nodeModels, setNodeModels] = useState<any[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [nodeError, setNodeError] = useState<string | null>(null);

  useEffect(() => {
    const loadOllamaConfig = async () => {
      try {
        const config = await db.getAPIConfig();
        const configuredUrl = config?.ollama_base_url || baseUrl || 'http://localhost:11434';
        if (!data.config.ollamaUrl) {
          data.config.ollamaUrl = configuredUrl;
          setCustomUrl(configuredUrl);
        }
      } catch (error) {
        console.error("Failed to load Ollama configuration:", error);
        if (!data.config.ollamaUrl) {
          data.config.ollamaUrl = baseUrl || 'http://localhost:11434';
          setCustomUrl(baseUrl || 'http://localhost:11434');
        }
      }
    };
    
    loadOllamaConfig();
  }, [baseUrl, data]);
  
  const fetchModels = async (url: string) => {
    setNodeLoading(true);
    setNodeError(null);
    try {
      const response = await fetch(`${url}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const json = await response.json();
      setNodeModels(json.models || []);
      if (json.models?.length > 0 && !model) {
        const firstModel = json.models[0]?.name;
        if (firstModel) {
          setModel(firstModel);
          data.config.model = firstModel;
        }
      }
    } catch (error) {
      setNodeError(error instanceof Error ? error.message : 'Failed to fetch models');
    } finally {
      setNodeLoading(false);
    }
  };
  
  useEffect(() => {
    if (customUrl) {
      fetchModels(customUrl);
    }
  }, [customUrl]);
  
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

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchModels(customUrl);
  };
  
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };
  
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
      
      {showSettings && (
        <div className="mb-3 p-2 border border-dashed rounded" onClick={stopPropagation} onMouseDown={stopPropagation}>
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
        </div>
      )}
      
      <div className="mb-2" onClick={stopPropagation} onMouseDown={stopPropagation}>
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Select LLM Model
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
            ) : nodeModels.length === 0 ? (
              <option>No models available</option>
            ) : (
              nodeModels.map(model => (
                <option 
                  key={model.name} 
                  value={model.name}
                >
                  {model.name} ({Math.round(model.size / 1024 / 1024 / 1024)}GB)
                </option>
              ))
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
  id: 'llm_prompt',
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

export default LLMPromptNode;
