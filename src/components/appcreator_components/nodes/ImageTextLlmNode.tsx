import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { useOllama } from '../../../context/OllamaContext';
import { ImagePlus, Settings, RefreshCw, MessageSquare, Eye } from 'lucide-react';
import { db } from '../../../db';

const ImageTextLlmNode: React.FC<any> = ({ data, isConnectable }) => {
  const { isDark } = useTheme();
  const { baseUrl } = useOllama();

  const tool = data.tool;
  const Icon = tool.icon || ImagePlus;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;

  const [model, setModel] = useState(data.config?.model || '');
  const [systemPrompt, setSystemPrompt] = useState(data.config?.systemPrompt || '');
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState(data.config?.ollamaUrl || '');

  // Node-specific states for models
  const [nodeModels, setNodeModels] = useState<any[]>([]);
  const [allModels, setAllModels] = useState<any[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [showAllModels, setShowAllModels] = useState(false);

  // Initialize config object if it doesn't exist
  if (!data.config) {
    data.config = {};
  }

  // Load Ollama configuration when component mounts
  useEffect(() => {
    const loadOllamaConfig = async () => {
      try {
        const config = await db.getAPIConfig();
        const configuredUrl = config?.ollama_base_url || baseUrl || 'http://localhost:11434';
        if (!data.config) {
          data.config = {};
        }
        if (!data.config.ollamaUrl) {
          data.config.ollamaUrl = configuredUrl;
          data.ollamaUrl = configuredUrl;
          setCustomUrl(configuredUrl);
          console.log("Initialized URL in node config:", configuredUrl);
        }
      } catch (error) {
        console.error("Failed to load Ollama configuration:", error);
        if (!data.config.ollamaUrl) {
          const fallbackUrl = baseUrl || 'http://localhost:11434';
          data.config.ollamaUrl = fallbackUrl;
          data.ollamaUrl = fallbackUrl;
          setCustomUrl(fallbackUrl);
        }
      }
    };

    loadOllamaConfig();
  }, [baseUrl, data]);

  // Heuristic to detect multimodal models
  const isLikelyMultimodalModel = (modelName: string) => {
    const visionModelPatterns = [
      'llava', 'bakllava', 'moondream', 'cogvlm', 'vision', 
      'image', 'visual', 'multimodal', 'clip', 'stable', 'dalle',
      'vqa', 'blip', 'v-', '-v', 'visualglm'
    ];
    const lowerName = modelName.toLowerCase();
    return visionModelPatterns.some(pattern => lowerName.includes(pattern));
  };

  // Fetch models using the node's custom URL
  const fetchModels = async (url: string) => {
    setNodeLoading(true);
    setNodeError(null);
    try {
      const response = await fetch(`${url}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const json = await response.json();
      const models = json.models || [];
      setAllModels(models);
      const multimodalModels = models.filter(m => isLikelyMultimodalModel(m.name));
      setNodeModels(multimodalModels.length > 0 ? multimodalModels : models);
      if (models.length > 0 && !model) {
        const targetModels = multimodalModels.length > 0 ? multimodalModels : models;
        const firstModel = targetModels[0]?.name;
        if (firstModel) {
          setModel(firstModel);
          data.config.model = firstModel;
        }
      }
    } catch (error) {
      setNodeError(error instanceof Error ? error.message : 'Failed to fetch models');
      console.error('Error fetching models:', error);
    } finally {
      setNodeLoading(false);
    }
  };

  // Fetch models when the URL changes
  useEffect(() => {
    if (customUrl) {
      fetchModels(customUrl);
    }
  }, [customUrl]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const selectedModel = e.target.value;
    setModel(selectedModel);
    if (!data.config) data.config = {};
    data.config.model = selectedModel;
    data.model = selectedModel;
    console.log("Updated model in node config:", selectedModel);
  };

  const handleSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    const promptText = e.target.value;
    setSystemPrompt(promptText);
    if (!data.config) data.config = {};
    data.config.systemPrompt = promptText;
    data.systemPrompt = promptText;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const url = e.target.value;
    setCustomUrl(url);
    if (!data.config) data.config = {};
    data.config.ollamaUrl = url;
    data.ollamaUrl = url;
    console.log("Updated URL in node config:", url);
    console.log("Current node config:", data.config);
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchModels(customUrl);
  };

  const handleToggleAllModels = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAllModels(!showAllModels);
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  const displayedModels = showAllModels ? allModels : nodeModels;

  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-72`}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <div className="flex items-center justify-between mb-2" onClick={stopPropagation}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor || '#8B5CF6' }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm">
            {data.label || 'Image + Text LLM'}
          </div>
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
        <div className="flex items-center justify-between">
          <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Select Vision-capable Model
          </label>
          <button
            onClick={handleToggleAllModels}
            className={`p-1 text-xs flex items-center gap-1 rounded ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
            }`}
          >
            <Eye size={12} />
            <span>{showAllModels ? 'Show Vision' : 'Show All'}</span>
          </button>
        </div>
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
              <option>No models found</option>
            ) : (
              displayedModels.map(model => {
                const isMultimodal = isLikelyMultimodalModel(model.name);
                return (
                  <option 
                    key={model.name} 
                    value={model.name}
                  >
                    {model.name} ({Math.round(model.size / 1024 / 1024 / 1024)}GB)
                    {isMultimodal ? " 🖼️" : ""}
                  </option>
                );
              })
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
        {!showAllModels && nodeModels.length === 0 && allModels.length > 0 && (
          <p className="text-xs text-amber-500 mt-1">
            No vision models detected. Try "Show All" to see all available models.
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Models with 🖼️ are likely to support images
        </p>
      </div>
      
      <div className="mb-2" onClick={stopPropagation} onMouseDown={stopPropagation}>
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          System Prompt (optional)
        </label>
        <textarea 
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          onKeyDown={stopPropagation}
          onFocus={stopPropagation}
          placeholder="Optional system prompt to guide the model..."
          className={`w-full p-2 rounded border ${
            isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
          } text-sm`}
          rows={2}
        />
      </div>
      
      <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
        <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 mb-1">
          <ImagePlus size={12} className="inline" />
          <span className="font-medium">Image Input</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300">
          <MessageSquare size={12} className="inline" />
          <span className="font-medium">Text Input</span>
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        id="image-in"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
        style={{ top: -6, left: '30%' }}
      />
      
      <Handle
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
        style={{ top: -6, left: '70%' }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="text-out"
        isConnectable={isConnectable}
        className="!bg-green-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

// Export metadata as a named export for NodeRegistry
export const metadata = {
  id: 'image_text_llm',
  name: 'Image + Text LLM',
  description: 'Process image and text with a vision model',
  icon: ImagePlus,
  color: 'bg-violet-500',
  bgColor: 'bg-violet-100',
  lightColor: '#8B5CF6',
  darkColor: '#7C3AED',
  category: 'function',
  inputs: ['image', 'text'],
  outputs: ['text'],
};

export default ImageTextLlmNode;
