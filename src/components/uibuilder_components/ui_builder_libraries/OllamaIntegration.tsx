import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, MessageSquare, Sliders, Network } from 'lucide-react';
import OllamaModelSelector from './OllamaModelSelector';
import OllamaSettings from './OllamaSettings';
import { OllamaModel, OllamaGenerationOptions } from './OllamaTypes';
import OllamaService from './OllamaService';
import ollamaSettingsStore from './OllamaSettingsStore';

interface OllamaIntegrationProps {
  onSendMessage?: (message: string, response: string) => void;
  className?: string;
}

const OllamaIntegration: React.FC<OllamaIntegrationProps> = ({
  onSendMessage,
  className = '',
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState<OllamaModel | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant that answers questions about UI development.');
  const [temperature, setTemperature] = useState(0.7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [response, setResponse] = useState('');
  
  // Initialize Ollama service
  const ollamaService = new OllamaService(ollamaSettingsStore.getConnection());
  
  // Handle model selection
  const handleModelSelect = (model: OllamaModel) => {
    setSelectedModel(model);
    // Save to localStorage for persistence
    localStorage.setItem('ollama_ui_builder_selected_model', JSON.stringify(model));
  };
  
  // Load previously selected model from localStorage
  useEffect(() => {
    const savedModel = localStorage.getItem('ollama_ui_builder_selected_model');
    if (savedModel) {
      try {
        setSelectedModel(JSON.parse(savedModel));
      } catch (e) {
        console.warn('Failed to parse saved model', e);
      }
    }
  }, []);
  
  // Generate completion
  const generateCompletion = async () => {
    if (!selectedModel || !userPrompt.trim()) return;
    
    setIsGenerating(true);
    setResponse('');
    
    try {
      const options: OllamaGenerationOptions = {
        model: selectedModel.name,
        prompt: userPrompt,
        system: systemPrompt,
        options: {
          temperature: temperature,
        }
      };
      
      // Use streaming for better UX
      await ollamaService.generateCompletionStream(
        options,
        (chunk) => {
          setResponse(prev => prev + chunk.response);
        },
        () => {
          setIsGenerating(false);
          // Notify parent component
          if (onSendMessage) {
            onSendMessage(userPrompt, response);
          }
        },
        (error) => {
          console.error('Generation error:', error);
          setIsGenerating(false);
        }
      );
    } catch (error) {
      console.error('Failed to generate completion:', error);
      setIsGenerating(false);
    }
  };
  
  const toggleSettings = () => {
    setShowSettings(prev => !prev);
  };
  
  const handleCloseSettings = () => {
    setShowSettings(false);
  };
  
  return (
    <div className={`rounded-lg ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <Network className="w-5 h-5 mr-2 text-sakura-500" />
          <h3 className="font-medium text-gray-800 dark:text-gray-200">Ollama AI Integration</h3>
        </div>
        
        <button
          onClick={toggleSettings}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          aria-label="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
      
      {showSettings ? (
        <OllamaSettings onClose={handleCloseSettings} />
      ) : (
        <>
          <div className="mb-4">
            <OllamaModelSelector
              onModelSelect={handleModelSelect}
              selectedModelId={selectedModel?.name}
            />
          </div>
          
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <Sliders className="w-4 h-4 mr-1" />
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Instructions for the AI"
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temperature ({temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>More precise</span>
                <span>More creative</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <MessageSquare className="w-4 h-4 mr-1" />
                User Prompt
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Enter your message to the AI"
                rows={3}
              />
            </div>
            
            <button
              onClick={generateCompletion}
              disabled={!selectedModel || !userPrompt.trim() || isGenerating}
              className="w-full py-2 px-4 flex items-center justify-center border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sakura-500 hover:bg-sakura-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sakura-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Response'}
            </button>
            
            {response && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AI Response
                </label>
                <div className="border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100">
                  <div className="whitespace-pre-wrap">{response}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default OllamaIntegration; 