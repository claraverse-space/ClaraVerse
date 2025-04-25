import React, { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Bot, Search, Image as ImageIcon, Loader2, RefreshCw, Download, HelpCircle } from 'lucide-react';
import { db } from '../../db';
import { OllamaClient } from '../../utils';
import { indexedDBService } from '../../services/indexedDB';
import ModelPullModal from './ModelPullModal';
import OnboardingModal from './OnboardingModal';
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
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      const apiType = config.api_type === 'ollama' || config.api_type === 'openai' 
        ? config.api_type 
        : 'openai' as const;

      const client = new OllamaClient(
        apiType === 'ollama' ? config.ollama_base_url : 'https://api.openai.com/v1', 
        { 
          type: apiType,
          apiKey: apiType === 'openai' ? config.openai_api_key : ''
        }
      );

      let modelList: string[] = [];
      try {
        if (config.api_type === 'ollama') {
          modelList = await client.listModels();
        }
      } catch (err: unknown) {
        console.error('Failed to load models:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        throw new Error(`Failed to load models: ${errorMessage}`);
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
    } catch (err: unknown) {
      console.error('Failed to load models:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Failed to load models: ${errorMessage}`);
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
        if (config) {
          // Ensure required fields have default values
          const configWithDefaults: APIConfig = {
            ollama_base_url: config.ollama_base_url || 'http://localhost:11434',
            comfyui_base_url: config.comfyui_base_url || '',
            api_type: config.api_type || 'ollama',
            openai_api_key: config.openai_api_key,
            openai_base_url: config.openai_base_url || 'https://api.openai.com/v1',
            openrouter_api_key: config.openrouter_api_key,
            n8n_base_url: config.n8n_base_url,
            n8n_api_key: config.n8n_api_key
          };
          setApiConfig(configWithDefaults);
          setApiType(configWithDefaults.api_type as 'ollama' | 'openai');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error('Failed to load config:', errorMessage);
        setError(`Failed to load config: ${errorMessage}`);
      }
    };

    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

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

  const handleApiTypeChange = async (type: 'ollama' | 'openai') => {
    if (apiConfig) {
      const updatedConfig: APIConfig = {
        ...apiConfig,
        api_type: type
      };
      await db.updateAPIConfig(updatedConfig);
      setApiConfig(updatedConfig);
      // Reload the page after configuration is saved
      window.location.reload();
    }
  };

  const handleOllamaUrlChange = async (url: string) => {
    if (apiConfig) {
      const updatedConfig: APIConfig = {
        ...apiConfig,
        ollama_base_url: url || 'http://localhost:11434'
      };
      await db.updateAPIConfig(updatedConfig);
      setApiConfig(updatedConfig);
    }
  };

  const handleOpenAIKeyChange = async (key: string) => {
    if (apiConfig) {
      const updatedConfig: APIConfig = {
        ...apiConfig,
        openai_api_key: key
      };
      await db.updateAPIConfig(updatedConfig);
      setApiConfig(updatedConfig);
    }
  };

  const handleOpenAIBaseUrlChange = async (url: string) => {
    if (apiConfig) {
      const updatedConfig: APIConfig = {
        ...apiConfig,
        openai_base_url: url || 'https://api.openai.com/v1'
      };
      await db.updateAPIConfig(updatedConfig);
      setApiConfig(updatedConfig);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnboarding(true)}
              className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-500 dark:text-gray-400"
              title="Setup Guide"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
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

          {/* API Type Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              API Type
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleApiTypeChange('ollama')}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  apiType === 'ollama'
                    ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-500/10'
                    : 'border-gray-200 hover:border-sakura-200 dark:border-gray-700'
                }`}
              >
                <div className="text-center">
                  <h3 className="font-medium text-gray-900 dark:text-white">Ollama</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Local AI models</p>
                </div>
              </button>
              <button
                onClick={() => handleApiTypeChange('openai')}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  apiType === 'openai'
                    ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-500/10'
                    : 'border-gray-200 hover:border-sakura-200 dark:border-gray-700'
                }`}
              >
                <div className="text-center">
                  <h3 className="font-medium text-gray-900 dark:text-white">OpenAI-like API</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Compatible with OpenAI API format</p>
                </div>
              </button>
            </div>
            
            {apiType === 'ollama' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ollama Base URL
                </label>
                <input
                  type="url"
                  value={apiConfig?.ollama_base_url || ''}
                  onChange={(e) => handleOllamaUrlChange(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="http://localhost:11434"
                />
              </div>
            )}

            {apiType === 'openai' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiConfig?.openai_api_key || ''}
                    onChange={(e) => handleOpenAIKeyChange(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base URL
                  </label>
                  <input
                    type="url"
                    value={apiConfig?.openai_base_url || 'https://api.openai.com/v1'}
                    onChange={(e) => handleOpenAIBaseUrlChange(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="https://api.openai.com/v1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Default: https://api.openai.com/v1. Change this if you're using a different OpenAI-compatible API endpoint.
                  </p>
                </div>
              </div>
            )}
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
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Model Manager
            </h3>
            <button
              onClick={() => setShowPullModal(true)}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-sakura-500 rounded-lg hover:bg-sakura-600 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Manage Models
            </button>
            <p className="mt-1 text-xs text-gray-500">
              Install and manage AI models for your assistant.
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

        <OnboardingModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          models={modelConfigs}
          onModelConfigSave={(config) => {
            // Refresh models after onboarding
            loadModels();
            setShowOnboarding(false);
          }}
        />
      </div>
    </div>
  );
};

export default AssistantSettings;