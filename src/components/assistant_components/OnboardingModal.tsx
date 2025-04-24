import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Terminal } from 'lucide-react';
import { db } from '../../db';
import { AssistantOllamaClient } from '../../utils';
import ModelPullModal from './ModelPullModal';

interface ModelConfig {
  visionModel: string;
  toolModel: string;
  ragModel: string;
}

interface ModelSelectionConfig extends ModelConfig {
  mode: 'auto' | 'manual' | 'smart';
}

interface APIConfig {
  api_type: 'ollama' | 'openai';
  ollama_base_url: string;
  openai_base_url: string;
  openai_api_key: string;
  comfyui_base_url: string;
  n8n_base_url?: string;
  n8n_api_key?: string;
}

interface HardwareConfig {
  ram: number;  // in GB
  hasGpu: boolean;
  gpuType?: 'nvidia' | 'amd' | 'apple' | 'none';
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: any[];
  onModelConfigSave: (config: ModelSelectionConfig) => void;
}

interface RecommendedModels {
  lite: { model: string; size: number };
  image: { model: string; size: number };
}

const RECOMMENDED_MODELS: RecommendedModels = {
  lite: {
    model: 'qwen2.5:latest',
    size: 4.7
  },
  image: {
    model: 'gemma3:4b',
    size: 3.8
  }
};

const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  models,
  onModelConfigSave,
}) => {
  const [selectedMode, setSelectedMode] = useState<'auto' | 'manual' | 'smart'>('auto');
  const [visionModel, setVisionModel] = useState('');
  const [toolModel, setToolModel] = useState('');
  const [ragModel, setRagModel] = useState('');
  const [currentStep, setCurrentStep] = useState<'api' | 'hardware' | 'models' | 'recommendations' | 'image_model' | 'final'>('api');
  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>({
    ram: 8,
    hasGpu: false,
    gpuType: 'none'
  });
  const [isUnsureOfSpecs, setIsUnsureOfSpecs] = useState(false);
  const [selectedModelSet, setSelectedModelSet] = useState<'full' | 'lite' | 'image' | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ model: string; progress: number }[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Initialize with default values
  const defaultApiConfig: APIConfig = {
    api_type: 'ollama',
    ollama_base_url: 'http://localhost:11434',
    openai_base_url: 'https://api.openai.com/v1',
    openai_api_key: '',
    comfyui_base_url: 'http://localhost:8188',
    n8n_base_url: '',
    n8n_api_key: ''
  };
  
  const [apiConfig, setApiConfig] = useState<APIConfig>(defaultApiConfig);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [client, setClient] = useState<AssistantOllamaClient | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [showModelPull, setShowModelPull] = useState(false);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  // Load saved configurations when modal opens
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        // Load API config
        const savedApiConfig = await db.getAPIConfig();
        if (savedApiConfig) {
          setApiConfig({
            ...defaultApiConfig,  // Start with defaults
            ...savedApiConfig,    // Override with saved values
            api_type: (savedApiConfig.api_type === 'openai' ? 'openai' : 'ollama') as 'ollama' | 'openai',
          });

          // Automatically test connection with saved config
          await testConnection();
        }

        // Load model selection config
        const savedModelConfig = localStorage.getItem('model_selection_config');
        if (savedModelConfig) {
          const config = JSON.parse(savedModelConfig);
          setSelectedMode(config.mode || 'auto');
          setVisionModel(config.visionModel || '');
          setToolModel(config.toolModel || '');
          setRagModel(config.ragModel || '');
        }
      } catch (error) {
        console.error('Error loading configurations:', error);
      }
    };

    if (isOpen) {
      loadConfigurations();
    }
  }, [isOpen]);

  // Auto-test connection when API type changes
  useEffect(() => {
    if (apiConfig.api_type === 'ollama' && apiConfig.ollama_base_url) {
      testConnection();
    } else if (apiConfig.api_type === 'openai' && apiConfig.openai_base_url) {
      testConnection();
    }
  }, [apiConfig.api_type]);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');
    
    try {
      let baseUrl: string;
      let clientConfig: any = {};

      if (apiConfig.api_type === 'ollama') {
        baseUrl = apiConfig.ollama_base_url || 'http://localhost:11434';
        clientConfig = { type: 'ollama' };
      } else {
        baseUrl = apiConfig.openai_base_url || 'https://api.openai.com/v1';
        clientConfig = {
          type: 'openai',
          apiKey: apiConfig.openai_api_key
        };
      }

      const client = new AssistantOllamaClient(baseUrl, clientConfig);
      const modelList = await client.listModels();
      
      setAvailableModels(modelList);
      setConnectionStatus('success');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect to API');
    }
  };

  const handleSave = async () => {
    // Save API config first
    await db.updateAPIConfig(apiConfig);

    // Then save model config
    onModelConfigSave({
      mode: selectedMode,
      visionModel,
      toolModel,
      ragModel,
    });
    onClose();
  };

  const handleNext = () => {
    if (currentStep === 'api') {
      if (apiConfig.api_type === 'ollama') {
        setCurrentStep('hardware');
      } else {
        setCurrentStep('models');
      }
    } else if (currentStep === 'hardware') {
      setCurrentStep('recommendations');
    } else if (currentStep === 'recommendations') {
      setCurrentStep('image_model');
    } else if (currentStep === 'image_model') {
      setCurrentStep('final');
    }
  };

  const handleModelDownload = async () => {
    if (!selectedModelSet || !client) return;
    
    setIsDownloading(true);
    const models = [RECOMMENDED_MODELS.lite.model];

    try {
      for (const model of models) {
        setCurrentModel(model);
        setLogs([
          `Starting download of ${model}...`,
          'Note: Download time may vary based on model size and internet speed.',
          'Please wait while we download and verify the model...'
        ]);

        try {
          for await (const data of client.pullModel(model)) {
            if (typeof data === 'object') {
              if (data.status === 'downloading') {
                if (data.digest) {
                  let percent = 0;
                  if (data.completed && data.total) {
                    percent = Math.round((data.completed / data.total) * 100);
                  }
                  
                  setLogs(prev => {
                    const newLogs = [...prev];
                    newLogs[newLogs.length - 1] = `Downloading model files... ${percent}%`;
                    return newLogs;
                  });
                }
              } else if (data.status === 'verifying') {
                addLog(`\nVerifying ${model}...`);
              } else if (data.status === 'done') {
                addLog(`\nSuccessfully installed ${model}`);
                await fetchModels();
              } else {
                addLog(`${data.status}`);
              }
            }

            if (terminalRef.current) {
              terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error('Error pulling model:', error);
          addLog(`\nError: Failed to pull ${model}`);
          if (error instanceof Error) {
            addLog(`Error details: ${error.message}`);
          }
          throw error;
        }
      }
      
      addLog('\nAll models installed successfully!');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsDownloading(false);
      handleNext();

    } catch (error) {
      console.error('Error downloading models:', error);
      addLog('\nAn error occurred during the download process.');
      addLog('Please try again or select different models.');
      setIsDownloading(false);
    }
  };

  const handleImageModelDownload = async () => {
    if (!client) return;
    
    setIsDownloading(true);
    const imageModel = RECOMMENDED_MODELS.image.model;

    try {
      setCurrentModel(imageModel);
      setLogs([
        `Starting download of ${imageModel}...`,
        'Note: Download time may vary based on model size and internet speed.',
        'Please wait while we download and verify the model...'
      ]);

      try {
        for await (const data of client.pullModel(imageModel)) {
          if (typeof data === 'object') {
            if (data.status === 'downloading') {
              if (data.digest) {
                let percent = 0;
                if (data.completed && data.total) {
                  percent = Math.round((data.completed / data.total) * 100);
                }
                
                setLogs(prev => {
                  const newLogs = [...prev];
                  newLogs[newLogs.length - 1] = `Downloading model files... ${percent}%`;
                  return newLogs;
                });
              }
            } else if (data.status === 'verifying') {
              addLog(`\nVerifying ${imageModel}...`);
            } else if (data.status === 'done') {
              addLog(`\nSuccessfully installed ${imageModel}`);
              await fetchModels();
            } else {
              addLog(`${data.status}`);
            }
          }

          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error('Error pulling model:', error);
        addLog(`\nError: Failed to pull ${imageModel}`);
        if (error instanceof Error) {
          addLog(`Error details: ${error.message}`);
        }
        throw error;
      }
      
      addLog('\nImage model installed successfully!');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsDownloading(false);
      handleNext();

    } catch (error) {
      console.error('Error downloading image model:', error);
      addLog('\nAn error occurred during the download process.');
      addLog('Please try again.');
      setIsDownloading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      if (data.models) {
        setAvailableModels(data.models);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  // Update the API config setter to reset connection status
  const updateApiConfig = (newConfig: Partial<APIConfig>) => {
    setApiConfig(prev => ({ ...prev, ...newConfig }));
    setConnectionStatus('idle');
    setConnectionError('');
    setAvailableModels([]);
  };

  // Add handlePullModel function
  const handlePullModel = async function* (modelName: string): AsyncGenerator<number, void, unknown> {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      // Forward all progress events from the client's pullModel
      for await (const progress of client.pullModel(modelName)) {
        yield typeof progress === 'number' ? progress : 0;
      }

      // Refresh available models list after successful pull
      const modelList = await client.listModels();
      setAvailableModels(modelList);
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  };

  // Initialize client when API config changes
  useEffect(() => {
    if (apiConfig.api_type === 'ollama' && apiConfig.ollama_base_url) {
      const newClient = new AssistantOllamaClient(apiConfig.ollama_base_url, { type: 'ollama' });
      setClient(newClient);
    }
  }, [apiConfig.api_type, apiConfig.ollama_base_url]);

  // Update the model selection dropdowns
  const renderModelDropdowns = () => (
    <div className="space-y-6 bg-white/50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
          Vision Model
        </label>
        <select
          value={visionModel}
          onChange={(e) => setVisionModel(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-sakura-500 dark:focus:border-sakura-500 focus:ring-2 focus:ring-sakura-500/20 transition-all text-gray-900 dark:text-white"
        >
          <option value="" className="text-gray-900 dark:text-white">Select a model</option>
          {availableModels.map((model) => (
            <option key={model.name} value={model.name} className="text-gray-900 dark:text-white">
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
          Tool Model
        </label>
        <select
          value={toolModel}
          onChange={(e) => setToolModel(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-sakura-500 dark:focus:border-sakura-500 focus:ring-2 focus:ring-sakura-500/20 transition-all text-gray-900 dark:text-white"
        >
          <option value="" className="text-gray-900 dark:text-white">Select a model</option>
          {availableModels.map((model) => (
            <option key={model.name} value={model.name} className="text-gray-900 dark:text-white">
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
          RAG Model
        </label>
        <select
          value={ragModel}
          onChange={(e) => setRagModel(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-sakura-500 dark:focus:border-sakura-500 focus:ring-2 focus:ring-sakura-500/20 transition-all text-gray-900 dark:text-white"
        >
          <option value="" className="text-gray-900 dark:text-white">Select a model</option>
          {availableModels.map((model) => (
            <option key={model.name} value={model.name} className="text-gray-900 dark:text-white">
              {model.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderHardwareStep = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        System Configuration
      </h3>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-medium">💡 Tip:</span> Not sure about your specs? No worries! Just click "I'm not sure" and Clara will use safe default settings.
        </p>
      </div>

      <div className="flex justify-center mb-4">
        <button
          onClick={() => {
            setIsUnsureOfSpecs(true);
            setHardwareConfig({
              ram: 8,
              hasGpu: false,
              gpuType: 'none'
            });
          }}
          className={`px-4 py-2 rounded-lg text-sm ${
            isUnsureOfSpecs
              ? 'bg-sakura-100 text-sakura-700 dark:bg-sakura-900/30 dark:text-sakura-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          I'm not sure about my specs
        </button>
      </div>

      {!isUnsureOfSpecs && (
        <div className="space-y-6 bg-white/50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
              RAM Size
            </label>
            <select
              value={hardwareConfig.ram}
              onChange={(e) => setHardwareConfig(prev => ({ ...prev, ram: Number(e.target.value) }))}
              className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-sakura-500 dark:focus:border-sakura-500 focus:ring-2 focus:ring-sakura-500/20 transition-all text-gray-900 dark:text-white"
            >
              <option value={4}>4 GB</option>
              <option value={8}>8 GB</option>
              <option value={16}>16 GB</option>
              <option value={32}>32 GB</option>
              <option value={64}>64 GB or more</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
              GPU Configuration
            </label>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={hardwareConfig.hasGpu}
                  onChange={(e) => setHardwareConfig(prev => ({
                    ...prev,
                    hasGpu: e.target.checked,
                    gpuType: e.target.checked ? prev.gpuType : 'none'
                  }))}
                  className="w-4 h-4 text-sakura-500 border-gray-300 rounded focus:ring-sakura-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  I have a dedicated GPU
                </span>
              </div>

              {hardwareConfig.hasGpu && (
                <select
                  value={hardwareConfig.gpuType}
                  onChange={(e) => setHardwareConfig(prev => ({
                    ...prev,
                    gpuType: e.target.value as HardwareConfig['gpuType']
                  }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-sakura-500 dark:focus:border-sakura-500 focus:ring-2 focus:ring-sakura-500/20 transition-all text-gray-900 dark:text-white"
                >
                  <option value="nvidia">NVIDIA GPU</option>
                  <option value="amd">AMD GPU</option>
                  <option value="apple">Apple Silicon (M1/M2/M3)</option>
                </select>
              )}
            </div>
          </div>
        </div>
      )}

      {isUnsureOfSpecs && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Clara will use safe default settings (8GB RAM, CPU-only) to ensure smooth operation. You can always update these settings later in the preferences.
          </p>
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4">
        <button
          onClick={() => setCurrentStep('api')}
          className="px-6 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-white font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-sakura-600 to-sakura-400 text-white font-medium hover:from-sakura-700 hover:to-sakura-500 transition-all duration-200 shadow-lg shadow-sakura-500/20 hover:shadow-sakura-500/30"
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderRecommendationsStep = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        Model Selection
      </h3>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-medium">💡 Tip:</span> Qwen 2.5 is a lightweight model suitable for most tasks.
        </p>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setSelectedModelSet('lite')}
          disabled={isDownloading}
          className={`w-full max-w-xl p-6 rounded-xl border-2 transition-all duration-200 ${
            selectedModelSet === 'lite'
              ? 'border-sakura-500 bg-sakura-50/50 dark:bg-sakura-900/20 shadow-lg shadow-sakura-500/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-sakura-300 dark:hover:border-sakura-700'
          }`}
        >
          <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Qwen 2.5B</h4>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              A lightweight and efficient model:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Model Size: {RECOMMENDED_MODELS.lite.size}GB</li>
              <li>• Suitable for general tasks</li>
            </ul>
          </div>
        </button>
      </div>

      {selectedModelSet && !isDownloading && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Ready to download DeepSeek R1 1.5B. Make sure you have a stable internet connection.
          </p>
        </div>
      )}

      {isDownloading && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-sakura-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Installation Progress - {currentModel}
            </h3>
          </div>
          <div
            ref={terminalRef}
            className="bg-gray-900 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm text-gray-100 whitespace-pre-wrap"
          >
            {logs.map((log, index) => (
              <div key={index} className="mb-1">
                <span className="text-sakura-500">&gt;</span> {log}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4">
        <button
          onClick={() => setCurrentStep('hardware')}
          className="px-6 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-white font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setShowModelPull(true)}
          className="px-6 py-2.5 rounded-lg border-2 border-sakura-500 text-sakura-600 hover:bg-sakura-50 font-medium transition-colors"
        >
          Open Model Manager
        </button>
        <button
          onClick={isDownloading ? undefined : handleModelDownload}
          disabled={!selectedModelSet || isDownloading}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-sakura-600 to-sakura-400 text-white font-medium hover:from-sakura-700 hover:to-sakura-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-sakura-500/20 hover:shadow-sakura-500/30"
        >
          {isDownloading ? 'Installing...' : 'Download Model'}
        </button>
      </div>

      <ModelPullModal
        isOpen={showModelPull}
        onClose={() => setShowModelPull(false)}
        onPullModel={handlePullModel}
      />
    </div>
  );

  const renderImageModelStep = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        Image Model Selection
      </h3>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-medium">💡 Tip:</span> Gemma 3 is a powerful model for image-related tasks.
        </p>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setSelectedModelSet('image')}
          disabled={isDownloading}
          className={`w-full max-w-xl p-6 rounded-xl border-2 transition-all duration-200 ${
            selectedModelSet === 'image'
              ? 'border-sakura-500 bg-sakura-50/50 dark:bg-sakura-900/20 shadow-lg shadow-sakura-500/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-sakura-300 dark:hover:border-sakura-700'
          }`}
        >
          <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Gemma 3</h4>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              A powerful image processing model:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Model Size: {RECOMMENDED_MODELS.image.size}GB</li>
              <li>• Optimized for image tasks</li>
            </ul>
          </div>
        </button>
      </div>

      {selectedModelSet && !isDownloading && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Ready to download Gemma 3. Make sure you have a stable internet connection.
          </p>
        </div>
      )}

      {isDownloading && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-sakura-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Installation Progress - {currentModel}
            </h3>
          </div>
          <div
            ref={terminalRef}
            className="bg-gray-900 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm text-gray-100 whitespace-pre-wrap"
          >
            {logs.map((log, index) => (
              <div key={index} className="mb-1">
                <span className="text-sakura-500">&gt;</span> {log}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4">
        <button
          onClick={() => setCurrentStep('recommendations')}
          className="px-6 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-white font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={isDownloading ? undefined : handleImageModelDownload}
          disabled={!selectedModelSet || isDownloading}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-sakura-600 to-sakura-400 text-white font-medium hover:from-sakura-700 hover:to-sakura-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-sakura-500/20 hover:shadow-sakura-500/30"
        >
          {isDownloading ? 'Installing...' : 'Download Image Model'}
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    if (currentStep === 'final') {
      // Automatically fetch and set models when reaching final step
      fetchModels().then(() => {
        const qwenModel = availableModels.find(m => m.name.includes('qwen2.5'));
        const gemmaModel = availableModels.find(m => m.name.includes('gemma3'));
        
        if (qwenModel) {
          setToolModel(qwenModel.name);
          setRagModel(qwenModel.name);
        }
        
        if (gemmaModel) {
          setVisionModel(gemmaModel.name);
        }
      });
    }
  }, [currentStep]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      {/* Backdrop with blur effect */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="relative w-full max-w-2xl rounded-2xl overflow-hidden">
          {/* Glassmorphic background */}
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md" />
          
          {/* Content container */}
          <div className="relative p-8">
            <div className="absolute right-6 top-6">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
              Welcome to Clara Assistant
            </Dialog.Title>

            <div className="space-y-8">
              {currentStep === 'api' ? (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Choose Your AI Provider
                  </h3>

                  <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100/50 dark:border-blue-800/50">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-medium">💡 Tip:</span> New to AI models? Just select Ollama and Clara will help you set everything up. Ollama runs models locally on your machine, making it perfect for getting started.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => updateApiConfig({ api_type: 'ollama' })}
                      className={`flex flex-col items-center p-6 rounded-xl transition-all duration-200 ${
                        apiConfig.api_type === 'ollama'
                          ? 'bg-sakura-50/50 dark:bg-sakura-500/10 shadow-lg shadow-sakura-500/10'
                          : 'bg-white/30 dark:bg-gray-900/30 hover:bg-white/50 dark:hover:bg-gray-900/50'
                      }`}
                    >
                      <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Ollama</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                        Run AI models locally on your machine
                      </p>
                      {apiConfig.api_type === 'ollama' && (
                        <span className="mt-2 px-2 py-1 bg-sakura-100/50 dark:bg-sakura-900/30 text-sakura-600 dark:text-sakura-300 text-xs rounded-full">
                          Recommended for beginners
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => updateApiConfig({ api_type: 'openai' })}
                      className={`flex flex-col items-center p-6 rounded-xl transition-all duration-200 ${
                        apiConfig.api_type === 'openai'
                          ? 'bg-sakura-50/50 dark:bg-sakura-500/10 shadow-lg shadow-sakura-500/10'
                          : 'bg-white/30 dark:bg-gray-900/30 hover:bg-white/50 dark:hover:bg-gray-900/50'
                      }`}
                    >
                      <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">OpenAI-like API</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                        Use OpenAI or compatible API providers
                      </p>
                      {apiConfig.api_type === 'openai' && (
                        <span className="mt-2 px-2 py-1 bg-sakura-100/50 dark:bg-sakura-900/30 text-sakura-600 dark:text-sakura-300 text-xs rounded-full">
                          For advanced users
                        </span>
                      )}
                    </button>
                  </div>

                  {/* API Configuration */}
                  <div className="mt-8 space-y-4">
                    {apiConfig.api_type === 'ollama' ? (
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                          Ollama Base URL
                        </label>
                        <input
                          type="url"
                          value={apiConfig.ollama_base_url}
                          onChange={(e) => updateApiConfig({ ollama_base_url: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl appearance-none bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm focus:bg-white/50 dark:focus:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-sakura-500/20 border-0 text-gray-900 dark:text-white shadow-sm transition-all"
                          placeholder="http://localhost:11434"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                            API Base URL
                          </label>
                          <input
                            type="url"
                            value={apiConfig.openai_base_url}
                            onChange={(e) => updateApiConfig({ openai_base_url: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl appearance-none bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm focus:bg-white/50 dark:focus:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-sakura-500/20 border-0 text-gray-900 dark:text-white shadow-sm transition-all"
                            placeholder="https://api.openai.com/v1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                            API Key
                          </label>
                          <input
                            type="password"
                            value={apiConfig.openai_api_key}
                            onChange={(e) => updateApiConfig({ openai_api_key: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl appearance-none bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm focus:bg-white/50 dark:focus:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-sakura-500/20 border-0 text-gray-900 dark:text-white shadow-sm transition-all"
                            placeholder="sk-..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Connection Test Section */}
                    <div className="mt-6">
                      <button
                        onClick={testConnection}
                        disabled={connectionStatus === 'testing'}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                          connectionStatus === 'testing'
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : connectionStatus === 'success'
                            ? 'bg-green-500 text-white'
                            : connectionStatus === 'error'
                            ? 'bg-red-500 text-white'
                            : 'bg-gradient-to-r from-sakura-600 to-sakura-400 text-white hover:from-sakura-700 hover:to-sakura-500'
                        }`}
                      >
                        {connectionStatus === 'testing' ? 'Testing Connection...' :
                         connectionStatus === 'success' ? 'Connection Successful!' :
                         connectionStatus === 'error' ? 'Connection Failed' :
                         'Test Connection'}
                      </button>

                      {connectionStatus === 'success' && (
                        <div className="mt-4 p-4 bg-green-50/50 dark:bg-green-900/20 rounded-xl border border-green-100/50 dark:border-green-800/50">
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Found {availableModels.length} available models
                          </p>
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            <ul className="text-sm text-green-600 dark:text-green-400">
                              {availableModels.map((model, index) => (
                                <li key={index}>{model.name}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {connectionStatus === 'error' && (
                        <div className="mt-4 p-4 bg-red-50/50 dark:bg-red-900/20 rounded-xl border border-red-100/50 dark:border-red-800/50">
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {connectionError || 'Failed to connect to API'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-900/50 text-gray-700 dark:text-white font-medium transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={connectionStatus !== 'success'}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sakura-600 to-sakura-400 text-white font-medium hover:from-sakura-700 hover:to-sakura-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-sakura-500/20 hover:shadow-sakura-500/30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : currentStep === 'hardware' ? (
                renderHardwareStep()
              ) : currentStep === 'recommendations' ? (
                renderRecommendationsStep()
              ) : currentStep === 'image_model' ? (
                renderImageModelStep()
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Selection Mode</h3>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="mode"
                          value="manual"
                          checked={selectedMode === 'manual'}
                          onChange={(e) => setSelectedMode(e.target.value as 'auto' | 'manual')}
                          className="form-radio text-sakura-500 focus:ring-sakura-500"
                        />
                        <div>
                          <span className="text-gray-900 dark:text-white font-medium">Manual Selection</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Choose models manually for each conversation.</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="mode"
                          value="auto"
                          checked={selectedMode === 'auto'}
                          onChange={(e) => setSelectedMode(e.target.value as 'auto' | 'manual')}
                          className="form-radio text-sakura-500 focus:ring-sakura-500"
                        />
                        <div>
                          <span className="text-gray-900 dark:text-white font-medium">Automatic Selection</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Let Clara choose the best model based on the context.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {(selectedMode === 'auto' || selectedMode === 'smart') && renderModelDropdowns()}

                  <div className="flex justify-end space-x-4 pt-4">
                    <button
                      onClick={() => setCurrentStep('image_model')}
                      className="px-6 py-2.5 rounded-xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-900/50 text-gray-700 dark:text-white font-medium transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={selectedMode === 'auto' && (!visionModel || !toolModel || !ragModel)}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sakura-600 to-sakura-400 text-white font-medium hover:from-sakura-700 hover:to-sakura-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-sakura-500/20 hover:shadow-sakura-500/30"
                    >
                      Save Preferences
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default OnboardingModal; 