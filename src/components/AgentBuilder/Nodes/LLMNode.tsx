import React, { memo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { Brain, Eye, RefreshCw, Check, AlertCircle } from 'lucide-react';
import BaseNode from './BaseNode';

const LLMNode = memo<NodeProps>((props) => {
  const { data } = props;
  const [apiBaseUrl, setApiBaseUrl] = useState(data.apiBaseUrl || 'https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState(data.apiKey || '');
  const [model, setModel] = useState(data.model || 'gpt-3.5-turbo');
  const [temperature, setTemperature] = useState(data.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(data.maxTokens || 1000);
  const [showConfig, setShowConfig] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [isConfigSaved, setIsConfigSaved] = useState(false);

  // Default models (fallback)
  const defaultModels = [
    'gpt-3.5-turbo',
    'gpt-4',
    'gpt-4-vision-preview',
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229'
  ];

  const handleApiBaseUrlChange = (value: string) => {
    setApiBaseUrl(value);
    setIsConfigSaved(false);
    if (data.onUpdate) {
      data.onUpdate({ data: { ...data, apiBaseUrl: value } });
    }
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setIsConfigSaved(false);
    if (data.onUpdate) {
      data.onUpdate({ data: { ...data, apiKey: value } });
    }
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    if (data.onUpdate) {
      data.onUpdate({ data: { ...data, model: value } });
    }
  };

  const handleTemperatureChange = (value: number) => {
    setTemperature(value);
    if (data.onUpdate) {
      data.onUpdate({ data: { ...data, temperature: value } });
    }
  };

  const handleMaxTokensChange = (value: number) => {
    setMaxTokens(value);
    if (data.onUpdate) {
      data.onUpdate({ data: { ...data, maxTokens: value } });
    }
  };

  const loadModelsFromAPI = async () => {
    if (!apiKey || !apiBaseUrl) {
      setModelLoadError('API Key and Base URL are required');
      return;
    }

    setIsLoadingModels(true);
    setModelLoadError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        // Extract model IDs and sort them
        const models = data.data
          .map((model: any) => model.id)
          .filter((id: string) => id && typeof id === 'string')
          .sort();
        
        if (models.length > 0) {
          setAvailableModels(models);
          setIsConfigSaved(true);
          
          // If current model is not in the list, set to first available model
          if (!models.includes(model)) {
            const firstModel = models[0];
            setModel(firstModel);
            if (data.onUpdate) {
              data.onUpdate({ data: { ...data, model: firstModel } });
            }
          }
        } else {
          throw new Error('No models found in API response');
        }
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      setModelLoadError(error instanceof Error ? error.message : 'Failed to load models');
      // Fall back to default models
      setAvailableModels(defaultModels);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSaveAndLoadModels = async () => {
    // Save current config first
    if (data.onUpdate) {
      data.onUpdate({ 
        data: { 
          ...data, 
          apiBaseUrl, 
          apiKey, 
          model, 
          temperature, 
          maxTokens 
        } 
      });
    }
    
    // Then load models
    await loadModelsFromAPI();
  };

  const modelsToShow = availableModels.length > 0 ? availableModels : defaultModels;
  const isVisionModel = model.includes('vision') || model.includes('gpt-4');

  return (
    <BaseNode
      {...props}
      title="LLM Chat"
      category="ai"
      icon={
        <div className="flex items-center gap-1">
          <Brain className="w-4 h-4" />
          {isVisionModel && <Eye className="w-3 h-3" />}
        </div>
      }
      inputs={data.inputs}
      outputs={data.outputs}
    >
      <div className="space-y-4">
        {/* Model Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Model
            </label>
            {availableModels.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3 h-3" />
                <span>{availableModels.length} loaded</span>
              </div>
            )}
          </div>
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all"
          >
            {modelsToShow.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>
          {availableModels.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Default models shown. Configure API to load available models.
            </p>
          )}
        </div>

        {/* Temperature & Max Tokens */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Temperature
            </label>
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-xs text-center text-gray-500 dark:text-gray-400 font-mono">
                {temperature}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Tokens
            </label>
            <input
              type="number"
              min="1"
              max="4000"
              value={maxTokens}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* API Configuration Toggle */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
        >
          {showConfig ? '🔒 Hide' : '⚙️ Show'} API Configuration
        </button>

        {/* API Configuration */}
        {showConfig && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Base URL
              </label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => handleApiBaseUrlChange(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all"
              />
            </div>
            
            {/* Save & Load Models Button */}
            <div className="pt-2">
              <button
                onClick={handleSaveAndLoadModels}
                disabled={!apiKey || !apiBaseUrl || isLoadingModels}
                className="w-full px-3 py-2.5 text-sm bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isLoadingModels ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading Models...
                  </>
                ) : isConfigSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved & Models Loaded
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Save & Load Models
                  </>
                )}
              </button>
              
              {/* Error Display */}
              {modelLoadError && (
                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <strong>Error loading models:</strong>
                    <br />
                    {modelLoadError}
                  </div>
                </div>
              )}
              
              {/* Success Message */}
              {isConfigSaved && !modelLoadError && availableModels.length > 0 && (
                <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-green-700 dark:text-green-300">
                    Successfully loaded {availableModels.length} models from API
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${apiKey ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">
              {apiKey ? '✓ API Ready' : '⚠ Missing API Key'}
            </span>
          </div>
          {isVisionModel && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
              <Eye className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Vision Enabled</span>
            </div>
          )}
        </div>

        {/* Output Labels */}
        {data.outputs && data.outputs.length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
            {data.outputs.map((output: any, index: number) => (
              <div
                key={output.id}
                className="text-xs text-gray-600 dark:text-gray-400 mb-1 text-right"
                style={{ marginTop: index === 0 ? 0 : '8px' }}
              >
                <span className="font-medium">{output.name}</span>
                <span className="text-gray-400 ml-1">({output.dataType})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

LLMNode.displayName = 'LLMNode';

export default LLMNode; 