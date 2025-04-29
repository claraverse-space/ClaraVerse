import React, { useEffect, useState, useCallback } from 'react';
import { Box, Network, Server, AlertTriangle, Check, RefreshCw } from 'lucide-react';

// Define OpenAI model types
interface OpenAIModel {
  id: string;
  name: string;
  maxTokens: number;
  category: 'gpt' | 'embedding' | 'image' | 'audio';
  contextWindow: number;
}

interface OpenAIModelSelectorProps {
  onModelSelect: (model: OpenAIModel) => void;
  selectedModelId?: string;
  className?: string;
  compact?: boolean;
  apiKey?: string;
  baseUrl?: string;
}

const OpenAIModelSelector: React.FC<OpenAIModelSelectorProps> = ({
  onModelSelect,
  selectedModelId,
  className = '',
  compact = false,
  apiKey,
  baseUrl
}) => {
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('connected');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.model-selector-dropdown')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check connection and fetch models if API key is available
  useEffect(() => {
    const fetchModels = async () => {
      setError(null);
      setConnectionStatus('checking');
      setIsLoading(true);

      try {
        if (!apiKey) {
          setConnectionStatus('disconnected');
          setError('No API key provided');
          return;
        }

        // Make API call to fetch models
        const url = `${baseUrl || 'https://api.openai.com/v1'}/models`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch models');
        }

        const data = await response.json();

        // Filter and transform models to include both GPT and O-series models
        const supportedModels = data.data
          .filter((model: any) => model.id.includes('gpt') || model.id.toLowerCase().includes('claude') || model.id.match(/o[1-4]/i))
          .map((model: any) => {
            // Format the model name to be more readable
            const name = model.id.includes('gpt') 
              ? model.id.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
              : model.id.includes('claude')
                ? model.id.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                : model.id.match(/o[1-4]/i)
                  ? `O${model.id.match(/[1-4]/)[0]}`
                  : model.id;

            return {
              id: model.id,
              name: name,
              maxTokens: 16000, // Set to 16000 for all OpenAI models
              category: 'gpt',
              contextWindow: 16000 // Set context window to match max tokens
            };
          });

        setModels(supportedModels);
        setConnectionStatus('connected');
        
      } catch (err) {
        setConnectionStatus('disconnected');
        setError(err instanceof Error ? err.message : 'Failed to connect to OpenAI API');
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [apiKey, baseUrl]);

  // Toggle dropdown
  const toggleDropdown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(prev => !prev);
  }, []);

  // Handle model selection
  const handleModelSelect = useCallback((model: OpenAIModel) => {
    onModelSelect(model);
    setIsDropdownOpen(false);
  }, [onModelSelect]);

  // Compact view for the dropdown selector
  if (compact) {
    // Find the currently selected model
    const selectedModel = models.find(model => model.id === selectedModelId);
    const selectedModelName = selectedModel?.name || 'Select model';
    
    return (
      <div className={`relative model-selector-dropdown ${className}`}>
        <button
          onClick={toggleDropdown}
          className={`w-full px-2 py-1 text-xs text-left flex items-center justify-between rounded-md bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
            !apiKey ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={!apiKey}
          title={!apiKey ? 'Configure OpenAI API key in settings' : undefined}
        >
          <span className="truncate">
            {isLoading ? (
              <span className="flex items-center">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Loading...
              </span>
            ) : (
              <>
                {connectionStatus === 'connected' ? (
                  selectedModelName
                ) : (
                  <span className="flex items-center text-red-500">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Not Connected
                  </span>
                )}
              </>
            )}
          </span>
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isDropdownOpen && (
          <div 
            className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="p-2 text-center">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-gray-500" />
              </div>
            ) : connectionStatus !== 'connected' ? (
              <div className="p-2 text-center text-xs text-red-500">
                <AlertTriangle className="w-4 h-4 mx-auto mb-1" />
                Not connected to OpenAI
              </div>
            ) : models.length === 0 ? (
              <div className="p-2 text-center text-xs text-gray-500">
                No GPT models available
              </div>
            ) : (
              models.map((model) => (
                <div
                  key={model.id}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedModelId === model.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => handleModelSelect(model)}
                >
                  <div className="font-medium">{model.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Model ID: {model.id}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Full view is not used in this context
  return null;
};

export default OpenAIModelSelector; 