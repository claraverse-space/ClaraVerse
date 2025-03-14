import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { useOllama } from '../../../context/OllamaContext';
import { Settings, RefreshCw, Sparkles } from 'lucide-react';
import { db } from '../../../db';

const ImageLlmPromptNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const { baseUrl } = useOllama();

  const tool = data.tool || {};
  const Icon = tool.icon || Settings;
  const nodeColor = isDark ? tool.darkColor || '#F87171' : tool.lightColor || '#EF4444';

  // State for LLM Prompt configuration
  const [model, setModel] = useState(data.config?.model || '');
  const [staticText, setStaticText] = useState(data.config?.staticText || 'Describe this image:');
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState(data.config?.ollamaUrl || '');

  // State for fetching available models
  const [nodeModels, setNodeModels] = useState<any[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [nodeError, setNodeError] = useState<string | null>(null);

  // Load Ollama config when component mounts
  useEffect(() => {
    const loadOllamaConfig = async () => {
      try {
        const config = await db.getAPIConfig();
        const configuredUrl = config?.ollama_base_url || baseUrl || 'http://localhost:11434';
        if (!data.config?.ollamaUrl) {
          data.config = { ...data.config, ollamaUrl: configuredUrl };
          setCustomUrl(configuredUrl);
        }
      } catch (error) {
        console.error("Failed to load Ollama configuration:", error);
        if (!data.config?.ollamaUrl) {
          data.config = { ...data.config, ollamaUrl: baseUrl || 'http://localhost:11434' };
          setCustomUrl(baseUrl || 'http://localhost:11434');
        }
      }
    };

    loadOllamaConfig();
  }, [baseUrl, data.config]);

  // Fetch models from the custom URL
  const fetchModels = async (url: string) => {
    setNodeLoading(true);
    setNodeError(null);

    try {
      const response = await fetch(`${url}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const result = await response.json();
      setNodeModels(result.models || []);

      // If models exist and no model is selected, choose the first model
      if (result.models?.length > 0 && !model) {
        const firstModel = result.models[0]?.name;
        if (firstModel) {
          setModel(firstModel);
          data.config = { ...data.config, model: firstModel };
        }
      }
    } catch (error) {
      setNodeError(error instanceof Error ? error.message : 'Failed to fetch models');
    } finally {
      setNodeLoading(false);
    }
  };

  // Refetch models when the URL changes
  useEffect(() => {
    if (customUrl) {
      fetchModels(customUrl);
    }
  }, [customUrl]);

  // Handlers for user input
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setModel(e.target.value);
    data.config = { ...data.config, model: e.target.value };
  };

  const handleStaticTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setStaticText(e.target.value);
    data.config = { ...data.config, staticText: e.target.value };
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setCustomUrl(e.target.value);
    data.config = { ...data.config, ollamaUrl: e.target.value };
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchModels(customUrl);
  };

  // Stop event propagation at the earliest phase
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-72`}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      {/* Header with Icon, Label and Settings Button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {data.label || 'Image LLM Prompt'}
          </div>
        </div>
        <button 
          onClick={handleSettingsClick}
          onMouseDown={stopPropagation}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Settings size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
        </button>
      </div>

      {/* Advanced Settings Panel for Ollama API URL */}
      {showSettings && (
        <div className="mb-3 p-2 border border-dashed rounded">
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
              placeholder="http://localhost:11434"
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
        </div>
      )}

      {/* LLM Model Selection */}
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Select LLM Model
        </label>
        <div className="flex items-center gap-2">
          <select 
            value={model}
            onChange={handleModelChange}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-sm`}
            disabled={nodeLoading}
          >
            {nodeLoading ? (
              <option>Loading models...</option>
            ) : nodeError ? (
              <option>Error loading models</option>
            ) : nodeModels.length === 0 ? (
              <option>No models available</option>
            ) : (
              nodeModels.map((m) => (
                <option 
                  key={m.name} 
                  value={m.name}
                >
                  {m.name} ({Math.round(m.size / 1024 / 1024 / 1024)}GB)
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

      {/* Static Text Input */}
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Static Text (sent with image)
        </label>
        <textarea 
          value={staticText}
          onChange={handleStaticTextChange}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          placeholder="Enter text to send with the image..."
          className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-sm`}
          rows={3}
        />
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Uses the /generate endpoint for image processing</span>
          </div>
        </div>
      </div>

      {/* Input and Output Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="image-in"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
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

export default ImageLlmPromptNode;
