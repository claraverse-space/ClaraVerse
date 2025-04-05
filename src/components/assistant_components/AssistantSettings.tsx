import React, { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Bot, Search, Image as ImageIcon, Loader2, RefreshCw, Download } from 'lucide-react';
import { db } from '../../db';
import { OllamaClient } from '../../utils';
import { indexedDBService } from '../../services/indexedDB';
import ModelPullModal from './ModelPullModal';
import { ToolManager } from './ToolManager';
import type { APIConfig } from '../../db';

interface ModelConfig {
  name: string;
  supportsImages: boolean;
  digest?: string;
  apiType?: 'ollama' | 'openai' | 'openrouter';
}

interface AssistantSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  isStreaming: boolean;
  setIsStreaming: (value: boolean) => void;
  onOpenTools: () => void;
}

const AssistantSettings: React.FC<AssistantSettingsProps> = ({
  isOpen,
  onClose,
  isStreaming,
  setIsStreaming,
  onOpenTools
}) => {
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPullModal, setShowPullModal] = useState(false);
  const [apiType, setApiType] = useState<'ollama' | 'openai'>('ollama');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isUsingDefault, setIsUsingDefault] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<APIConfig | null>(null);

  const loadModels = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const config = await db.getAPIConfig();
      if (!config) {
        setError('API not configured. Please configure it in settings.');
        return;
      }

      // Store the API type for UI decisions
      setApiType(config.api_type as 'ollama' | 'openai');

      const client = new OllamaClient(
        config.api_type === 'ollama' ? config.ollama_base_url : (config.openai_base_url || 'https://api.openai.com/v1'), 
        { 
          type: config.api_type,
          apiKey: config.api_type === 'openai' ? config.openai_api_key : ''
        }
      );

      let modelList;
      try {
        // For OpenAI, we'll create a fallback model list if the real listing fails
        if (config.api_type === 'openai') {
          try {
            modelList = await client.listModels();
          } catch (err) {
            console.warn('Could not load OpenAI models, using fallback list', err);
            modelList = [
              { name: 'gpt-3.5-turbo' },
              { name: 'gpt-4' },
              { name: 'gpt-4-vision-preview', supportsImages: true },
              { name: 'gpt-4o', supportsImages: true },
              { name: 'gpt-4o-mini' }
            ];
          }
        } else {
          modelList = await client.listModels();
        }
      } catch (err) {
        throw err;
      }

      // Get existing configs
      const existingConfigs = localStorage.getItem('model_image_support');
      const existingModelConfigs = existingConfigs ? JSON.parse(existingConfigs) : [];

      // Merge existing configs with new models
      const updatedConfigs = modelList.map((model: any) => {
        const existing = existingModelConfigs.find((c: ModelConfig) => 
          c.name === (model.name || model.id)
        );
        
        const modelName = model.name || model.id;
        return {
          name: modelName,
          digest: model.digest || '',
          supportsImages: existing ? existing.supportsImages : 
            modelName.toLowerCase().includes('vision') || 
            modelName.toLowerCase().includes('llava') ||
            modelName.toLowerCase().includes('bakllava') ||
            modelName.toLowerCase().includes('gpt-4o')
        };
      });

      setModelConfigs(updatedConfigs);
      localStorage.setItem('model_image_support', JSON.stringify(updatedConfigs));
    } catch (err) {
      console.error('Failed to load models:', err);
      setError(`Failed to load models: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const prompt = await db.getSystemPrompt();
        setSystemPrompt(prompt);
        
        // Check if system prompt has been customized
        const settings = await indexedDBService.get('settings', 'system_settings');
        setIsUsingDefault(!settings);
      } catch (error) {
        console.error('Error loading system prompt:', error);
        // Let db.getSystemPrompt() handle the default value
        const defaultPrompt = await db.getSystemPrompt();
        setSystemPrompt(defaultPrompt);
        setIsUsingDefault(true);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await db.getAPIConfig();
        if (config && config.api_type) {
          setApiConfig(config as APIConfig);
        }
      } catch (err) {
        console.error('Failed to load API config:', err);
      }
    };
    loadConfig();
  }, []);

  const handleModelConfigChange = (modelName: string, supportsImages: boolean) => {
    const updatedConfigs = modelConfigs.map(config =>
      config.name === modelName ? { ...config, supportsImages } : config
    );
    setModelConfigs(updatedConfigs);
    localStorage.setItem('model_image_support', JSON.stringify(updatedConfigs));
  };

  const handlePullModel = async function* (modelName: string): AsyncGenerator<any, void, unknown> {
    try {
      const config = await db.getAPIConfig();
      if (!config?.ollama_base_url) {
        throw new Error('Ollama URL not configured');
      }

      const client = new OllamaClient(config.ollama_base_url);
      for await (const progress of client.pullModel(modelName)) {
        yield progress;
      }
      
      // Refresh model list after successful pull
      await loadModels();
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  };

  const handleUpdateSystemPrompt = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setSystemPrompt(newPrompt);
    setIsSavingPrompt(true);
    
    try {
      await db.updateSystemPrompt(newPrompt);
    } catch (error) {
      console.error('Failed to save system prompt:', error);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const filteredModels = modelConfigs.filter(config =>
    config.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glassmorphic rounded-2xl p-8 max-w-2xl w-full mx-4 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-sakura-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Assistant Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              System Prompt
            </h3>
            <div className="relative">
              <textarea
                value={systemPrompt}
                onChange={handleUpdateSystemPrompt}
                placeholder="Enter a system prompt that will be included at the start of all conversations..."
                className="w-full min-h-[100px] p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
              />
              {isSavingPrompt && (
                <div className="absolute top-2 right-2 text-xs text-gray-500 dark:text-gray-400">
                  Saving...
                </div>
              )}
              {isUsingDefault && (
                <div className="mt-1 text-xs text-gray-500">
                  Using default system prompt. Edit to customize.
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              This prompt will be added as a system message at the beginning of each conversation.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Tools
            </h3>
            <button
              onClick={() => {
                onClose();
                onOpenTools();
              }}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-sakura-500 rounded-lg hover:bg-sakura-600 transition-colors flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4" />
              Manage Custom Tools
            </button>
            <p className="mt-1 text-xs text-gray-500">
              Create and manage custom tools to extend the assistant's capabilities.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Streaming
            </h3>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isStreaming}
                  onChange={(e) => setIsStreaming(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sakura-300 dark:peer-focus:ring-sakura-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-sakura-500"></div>
              </label>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Enable streaming responses
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              When enabled, responses will be streamed in real-time as they're generated.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Model Image Support Configuration
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Configure which models can process images
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadModels}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Refresh Models"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                {apiType === 'ollama' && (
                  <button
                    onClick={() => setShowPullModal(true)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="Pull New Model"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {error ? (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                {error}
                {apiType === 'openai' && (
                  <div className="mt-2 font-medium">
                    Using OpenAI models. Switch to Ollama in Settings for local models.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-sakura-500" />
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No models found
                    </div>
                  ) : (
                    filteredModels.map((config) => (
                      <div
                        key={config.name}
                        className="flex items-center justify-between p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <Bot className="w-5 h-5 text-gray-500" />
                          <div>
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {config.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {config.digest ? config.digest.slice(0, 8) : 'OpenAI Model'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            Image Support
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={config.supportsImages}
                              onChange={(e) => handleModelConfigChange(config.name, e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sakura-300 dark:peer-focus:ring-sakura-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-sakura-500"></div>
                            <ImageIcon className={`ml-2 w-4 h-4 ${config.supportsImages ? 'text-sakura-500' : 'text-gray-400'}`} />
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <ModelPullModal
          isOpen={showPullModal}
          onClose={() => setShowPullModal(false)}
          onPullModel={handlePullModel}
        />
      </div>
    </div>
  );
};

export default AssistantSettings;