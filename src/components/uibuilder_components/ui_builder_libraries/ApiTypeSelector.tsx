import React, { useState, useEffect } from 'react';
import { Settings, Server, ExternalLink } from 'lucide-react';
import { db } from '../../../db';

interface ApiTypeSelectorProps {
  onApiTypeChange: (apiType: 'ollama' | 'openai') => void;
  currentApiType: string;
  onPageChange: (page: string) => void;
}

const ApiTypeSelector: React.FC<ApiTypeSelectorProps> = ({ 
  onApiTypeChange,
  currentApiType = 'ollama',
  onPageChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<{
    api_type?: string;
    ollama_base_url?: string;
    openai_base_url?: string;
    openai_api_key?: string;
  }>({
    api_type: currentApiType,
    ollama_base_url: '',
    openai_base_url: '',
    openai_api_key: ''
  });

  useEffect(() => {
    // Load the API configuration from the database
    const loadApiConfig = async () => {
      try {
        const config = await db.getAPIConfig();
        if (config) {
          setApiConfig({
            api_type: config.api_type || 'ollama',
            ollama_base_url: config.ollama_base_url || '',
            openai_base_url: config.openai_base_url || '',
            openai_api_key: config.openai_api_key || ''
          });
        }
      } catch (error) {
        console.error('Failed to load API configuration:', error);
      }
    };

    loadApiConfig();
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleSelectApiType = async (type: 'ollama' | 'openai') => {
    try {
      // Update local state
      setApiConfig(prev => ({ ...prev, api_type: type }));
      
      // Update database
      const currentConfig = await db.getAPIConfig();
      if (currentConfig) {
        await db.updateAPIConfig({
          ...currentConfig,
          api_type: type
        });
      }
      
      // Notify parent component
      onApiTypeChange(type);
      
      // Close dropdown
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update API type:', error);
    }
  };

  const openSettingsPage = () => {
    // Use the onPageChange prop to navigate
    onPageChange('settings');
  };

  return (
    <div className="relative">
      <button 
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="API Settings"
      >
        <Settings className="w-3.5 h-3.5" />
        <span>API: {currentApiType === 'openai' ? 'OpenAI' : 'Ollama'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2">
            <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Select API Provider</h3>
            
            <div className="space-y-1">
              <button
                onClick={() => handleSelectApiType('ollama')}
                className={`flex items-center w-full px-3 py-2 text-xs rounded-md transition-colors ${
                  currentApiType === 'ollama'
                    ? 'bg-sakura-100 dark:bg-sakura-900/30 text-sakura-800 dark:text-sakura-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Server className="w-3.5 h-3.5 mr-2" />
                <span>Ollama (Local AI)</span>
              </button>
              
              <button
                onClick={() => handleSelectApiType('openai')}
                className={`flex items-center w-full px-3 py-2 text-xs rounded-md transition-colors ${
                  currentApiType === 'openai'
                    ? 'bg-sakura-100 dark:bg-sakura-900/30 text-sakura-800 dark:text-sakura-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                <span>OpenAI API</span>
              </button>
            </div>
            
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={openSettingsPage}
                className="flex items-center w-full px-3 py-2 text-xs rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 mr-2" />
                <span>Configure API Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiTypeSelector; 