import React, { useRef, useEffect, useState } from 'react';
import { Wand2, MessageSquare, Layout, Network } from 'lucide-react';
import { OllamaModelSelector, OpenAIModelSelector } from './ui_builder_libraries';
import { OllamaModel } from './ui_builder_libraries/OllamaTypes';
import { OpenAIModel } from './ui_builder_libraries/OpenAITypes';
import { Message } from './ui_builder_libraries/ProjectTypes';
import { db } from '../../db';

interface ChatPanelProps {
  messages: Message[];
  mode: 'chat' | 'design';
  onModeChange: (mode: 'chat' | 'design') => void;
  selectedModel: OllamaModel | OpenAIModel | null;
  onModelSelect: (model: OllamaModel | OpenAIModel) => void;
  apiType?: 'ollama' | 'openai';
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  mode, 
  onModeChange, 
  selectedModel,
  onModelSelect,
  apiType = 'ollama'
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [apiConfig, setApiConfig] = useState<{
    openai_api_key?: string;
    openai_base_url?: string;
  }>({});

  // Load API config
  useEffect(() => {
    const loadApiConfig = async () => {
      const config = await db.getAPIConfig();
      console.log('ChatPanel: Loading API config:', config);
      if (config) {
        setApiConfig({
          openai_api_key: config.openai_api_key || '',
          openai_base_url: config.openai_base_url || 'https://api.openai.com/v1'
        });
      }
    };

    console.log('ChatPanel: Current API type:', apiType);
    loadApiConfig();
  }, [apiType]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Immediately scroll to bottom with no animation for better performance
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Handle model selection based on API type
  const handleModelSelect = (model: OllamaModel | OpenAIModel) => {
    console.log('ChatPanel: Model selected:', model);
    console.log('ChatPanel: Current API type:', apiType);
    onModelSelect(model);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Chat Mode Selector - Fixed height header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-2 px-4 h-12 flex-shrink-0">
        <div className="flex gap-2">
          <button 
            onClick={() => onModeChange('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'chat' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button 
            onClick={() => onModeChange('design')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'design' 
                ? 'bg-sakura-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Design</span>
          </button>
        </div>
        <div className="flex items-center">
          <Network className="w-3.5 h-3.5 mr-1 text-gray-500" />
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 w-40">
            {apiType === 'ollama' ? (
              <OllamaModelSelector
                onModelSelect={handleModelSelect as (model: OllamaModel) => void}
                selectedModelId={selectedModel?.name}
                compact={true}
              />
            ) : (
              <OpenAIModelSelector
                key={`openai-selector-${apiConfig.openai_api_key}`}
                onModelSelect={handleModelSelect as (model: OpenAIModel) => void}
                selectedModelId={(selectedModel as OpenAIModel)?.id}
                apiKey={apiConfig.openai_api_key}
                baseUrl={apiConfig.openai_base_url}
                compact={true}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Messages Section - Scrollable area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4"
        style={{ 
          height: "calc(100% - 48px)",
          minHeight: 0,
          overflowAnchor: "none" // Prevents browser from automatically managing scroll position
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 p-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              {mode === 'design' ? (
                <Layout className="w-8 h-8 text-sakura-400 dark:text-sakura-500" />
              ) : (
                <MessageSquare className="w-8 h-8 text-blue-400 dark:text-blue-500" />
              )}
            </div>
            <p className="text-sm font-medium mb-2">No messages yet</p>
            <p className="text-xs max-w-md leading-relaxed">
              {mode === 'design' 
                ? "Describe UI elements you want to create, like 'create a form with name and email fields'" 
                : "Ask any question to start a conversation"}
            </p>
          </div>
        ) : (
          // Fixed container for messages with gap between them
          <div className="flex flex-col gap-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-sakura-100 dark:bg-sakura-900/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Wand2 className="w-4 h-4 text-sakura-500" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] p-3 rounded-xl shadow-sm ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/20 rounded-tr-md'
                      : 'bg-white dark:bg-gray-800/80 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700/50 rounded-tl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <div className="text-xs mt-1 text-right opacity-80 text-gray-200 dark:text-gray-400">
                    {message.timestamp 
                      ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {message.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {/* This element is used for scrolling to the bottom */}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel; 