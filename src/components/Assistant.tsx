import React, { useState, useEffect, useRef } from 'react';
import AssistantSidebar from './AssistantSidebar';
import { AssistantHeader, ChatInput, ChatWindow } from './assistant_components';
import AssistantSettings from './assistant_components/AssistantSettings';
import ImageWarning from './assistant_components/ImageWarning';
import ModelWarning from './assistant_components/ModelWarning';
import ModelPullModal from './assistant_components/ModelPullModal';
import { db } from '../db';
import { OllamaClient } from '../utils';
import type { Message, Chat } from '../db';

interface UploadedImage {
  id: string;
  base64: string;
  preview: string;
}

interface AssistantProps {
  onPageChange: (page: string) => void;
}

const MAX_CONTEXT_MESSAGES = 20;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const Assistant: React.FC<AssistantProps> = ({ onPageChange }) => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [client, setClient] = useState<OllamaClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    const storedModel = localStorage.getItem('selected_model');
    return storedModel || '';
  });
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isStreaming, setIsStreaming] = useState(() => {
    const stored = localStorage.getItem('assistant_streaming');
    return stored === null ? true : stored === 'true';
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [showImageWarning, setShowImageWarning] = useState(true);
  const [showModelWarning, setShowModelWarning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showPullModal, setShowPullModal] = useState(false);

  const checkModelImageSupport = (modelName: string): boolean => {
    const configs = localStorage.getItem('model_image_support');
    if (!configs) return false;
    
    const modelConfigs = JSON.parse(configs);
    const config = modelConfigs.find((c: any) => c.name === modelName);
    return config?.supportsImages || false;
  };

  const findImageSupportedModel = (): string | null => {
    const configs = localStorage.getItem('model_image_support');
    if (!configs) return null;
    
    const modelConfigs = JSON.parse(configs);
    const imageModel = modelConfigs.find((c: any) => c.supportsImages);
    return imageModel ? imageModel.name : null;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  const handleNavigateHome = () => {
    onPageChange('dashboard');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: UploadedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_IMAGE_SIZE) {
        console.error(`Image ${file.name} exceeds 10MB limit`);
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newImages.push({
          id: crypto.randomUUID(),
          base64: base64.split(',')[1], // Remove data URL prefix
          preview: base64
        });
      } catch (err) {
        console.error(`Failed to process image ${file.name}`);
      }
    }

    setImages(prev => [...prev, ...newImages]);

    // Check if current model supports images
    if (!checkModelImageSupport(selectedModel)) {
      const imageModel = findImageSupportedModel();
      if (imageModel) {
        setSelectedModel(imageModel);
      } else {
        setShowModelWarning(true);
      }
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  useEffect(() => {
    // Check for pending chat query from search bar
    const pendingQuery = localStorage.getItem('pending_chat_query');
    if (pendingQuery) {
      // Clear the pending query
      localStorage.removeItem('pending_chat_query');
      // Set the input
      setInput(pendingQuery);
      // Create a new chat and send the message
      handleNewChat(pendingQuery);
    }
  }, []); // Run only once on component mount

  useEffect(() => {
    const loadChatMessages = async () => {
      if (activeChat) {
        try {
          const chatMessages = await db.getChatMessages(activeChat);
          setMessages(chatMessages);
        } catch (error) {
          console.error('Error loading chat messages:', error);
        }
      }
    };
    
    if (activeChat) {
      loadChatMessages();
    }
  }, [activeChat]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('auto');
    }
  }, [messages]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
      return () => chatContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Load initial chat data
  useEffect(() => {
    const loadInitialChat = async () => {
      const recentChats = await db.getRecentChats();
      setChats(recentChats);

      if (recentChats.length > 0) {
        // Load the most recent chat
        const latestChat = recentChats[0];
        setActiveChat(latestChat.id);
        const chatMessages = await db.getChatMessages(latestChat.id);
        setMessages(chatMessages);
      } else {
        // Create a new chat if none exist
        handleNewChat();
      }
    };
    loadInitialChat();
  }, []);

  const getMostUsedModel = async (availableModels: any[]): Promise<string | null> => {
    try {
      // Get model usage statistics from the database
      const modelUsage = await db.getModelUsage();
      
      if (!modelUsage || Object.keys(modelUsage).length === 0) {
        return null;
      }
      
      // Filter to only include currently available models
      const availableModelNames = availableModels.map(model => model.name);
      const validUsageEntries = Object.entries(modelUsage)
        .filter(([modelName]) => availableModelNames.includes(modelName));
      
      if (validUsageEntries.length === 0) {
        return null;
      }
      
      // Find the model with the highest usage
      const mostUsed = validUsageEntries.reduce((max, current) => {
        return (current[1] > max[1]) ? current : max;
      });
      
      return mostUsed[0];
    } catch (error) {
      console.error('Error getting most used model:', error);
      return null;
    }
  };

  useEffect(() => {
    const initializeOllama = async () => {
      const config = await db.getAPIConfig();
      if (config?.ollama_base_url) {
        const newClient = new OllamaClient(config.ollama_base_url);
        setClient(newClient);
        try {
          const modelList = await newClient.listModels();
          setModels(modelList);
          
          if (modelList.length === 0) {
            setShowPullModal(true);
          }
          
          // Initialize model configs if they don't exist
          const existingConfigs = localStorage.getItem('model_image_support');
          if (!existingConfigs) {
            const initialConfigs = modelList.map((model: any) => ({
              name: model.name,
              supportsImages: model.name.includes('llava') || model.name.includes('bakllava')
            }));
            localStorage.setItem('model_image_support', JSON.stringify(initialConfigs));
          }
          
          // Select default model based on storage or usage
          const storedModel = localStorage.getItem('selected_model');
          if (storedModel && modelList.some(model => model.name === storedModel)) {
            setSelectedModel(storedModel);
          } else if (modelList.length > 0) {
            const mostUsedModel = await getMostUsedModel(modelList);
            const modelToUse = mostUsedModel || modelList[0].name;
            setSelectedModel(modelToUse);
            localStorage.setItem('selected_model', modelToUse);
          }
          setConnectionStatus('connected');
        } catch (err) {
          setConnectionStatus('disconnected');
        }
      } else {
        setConnectionStatus('disconnected');
      }
    };
    initializeOllama();
  }, []);

  const handleNewChat = async (initialMessage?: string) => {
    const chatId = await db.createChat(initialMessage?.slice(0, 30) || 'New Chat');
    setActiveChat(chatId);
    const welcomeMessage = {
      id: crypto.randomUUID(),
      chat_id: chatId,
      content: "Hello! How can I help you today?",
      role: 'assistant' as const,
      timestamp: new Date().toISOString(),
      tokens: 0
    };
    await db.addMessage(
      chatId,
      welcomeMessage.content,
      welcomeMessage.role,
      welcomeMessage.tokens
    );
    setMessages([welcomeMessage]);
    const updatedChats = await db.getRecentChats();
    setChats(updatedChats);

    // If there's an initial message, send it immediately
    if (initialMessage) {
      setInput(initialMessage);
      setTimeout(() => handleSend(), 100);
    }
  };

  const getContextMessages = (messages: Message[]): Message[] => {
    // Get the last MAX_CONTEXT_MESSAGES messages
    return messages.slice(-MAX_CONTEXT_MESSAGES);
  };

  const formatMessagesForModel = (messages: Message[]): { role: string; content: string }[] => {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || !client || !selectedModel || isProcessing) return;

    // Check if we're using images with a non-image model
    if (images.length > 0 && !checkModelImageSupport(selectedModel)) {
      setShowModelWarning(true);
      return;
    }

    let currentChatId = activeChat;
    if (!currentChatId) {
      currentChatId = await db.createChat(input.slice(0, 30));
      setActiveChat(currentChatId);
      const updatedChats = await db.getRecentChats();
      setChats(updatedChats);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      chat_id: currentChatId,
      content: input,
      role: 'user',
      timestamp: new Date().toISOString(),
      tokens: 0,
      images: images.length > 0 ? images.map(img => img.preview) : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImages([]);

    try {
      setIsProcessing(true);
      const startTime = performance.now();
      
      // Create a placeholder for the response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        chat_id: currentChatId,
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        tokens: 0
      };
      setMessages(prev => [...prev, assistantMessage]);

      let fullResponse = '';
      let totalTokens = 0;

      // Get context messages
      const contextMessages = getContextMessages([...messages, userMessage]);
      const formattedMessages = formatMessagesForModel(contextMessages);

      if (images.length > 0) {
        // Use image generation endpoint
        const response = await client.generateWithImages(
          selectedModel,
          input,
          images.map(img => img.base64)
        );
        fullResponse = response.response || '';
        totalTokens = response.eval_count || 0;
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id
            ? { ...msg, content: fullResponse, tokens: totalTokens }
            : msg
        ));
      } else if (isStreaming) {
        // Streaming response with context
        for await (const chunk of client.streamChat(selectedModel, formattedMessages)) {
          if (chunk.message?.content) {
            fullResponse += chunk.message.content;
            totalTokens = chunk.eval_count || 0;
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessage.id
                ? { ...msg, content: fullResponse, tokens: totalTokens }
                : msg
            ));
            
            scrollToBottom();
          }
        }
      } else {
        // Non-streaming response with context
        const response = await client.sendChat(selectedModel, formattedMessages);
        fullResponse = response.message?.content || '';
        totalTokens = response.eval_count || 0;
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id
            ? { ...msg, content: fullResponse, tokens: totalTokens }
            : msg
        ));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Update model usage statistics
      await db.updateModelUsage(selectedModel, duration);
      await db.updateUsage('response_time', duration);

      // Save the messages to the database
      const inputTokens = totalTokens; // This is approximate
      userMessage.tokens = inputTokens;
      await db.addMessage(
        currentChatId, 
        userMessage.content, 
        userMessage.role, 
        inputTokens,
        userMessage.images
      );
      await db.addMessage(currentChatId, fullResponse, 'assistant', totalTokens);

      // Update chat title if it's the first message
      if (messages.length <= 1) {
        const title = input.slice(0, 30) + (input.length > 30 ? '...' : '');
        await db.updateChat(currentChatId, { title });
        const updatedChats = await db.getRecentChats();
        setChats(updatedChats);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        chat_id: currentChatId,
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        role: 'assistant',
        timestamp: new Date().toISOString(),
        tokens: 0
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopStreaming = () => {
    if (!client || !isProcessing) return;
    
    // Abort the current stream
    client.abortStream();
    
    // Update the UI to show that streaming has stopped
    setIsProcessing(false);
    
    // Add a note to the last message to indicate it was interrupted
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        return prev.map((msg, idx) => {
          if (idx === prev.length - 1) {
            return {
              ...msg,
              content: msg.content + "\n\n_Response was interrupted._"
            };
          }
          return msg;
        });
      }
      return prev;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
    localStorage.setItem('selected_model', modelName);
  };

  const handlePullModel = async function* (modelName: string): AsyncGenerator<any, void, unknown> {
    if (!client) throw new Error('Client not initialized');
    
    try {
      // Forward all progress events from the client's pullModel
      for await (const progress of client.pullModel(modelName)) {
        yield progress;
      }
      
      // Refresh model list after successful pull
      const modelList = await client.listModels();
      setModels(modelList);
      
      // Set as selected model
      setSelectedModel(modelName);
      localStorage.setItem('selected_model', modelName);
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error; // Re-throw to be handled by the modal
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-white to-sakura-100 dark:from-gray-900 dark:to-sakura-100/10">
      <AssistantSidebar 
        activeChat={activeChat} 
        onChatSelect={setActiveChat}
        chats={chats}
        onOpenSettings={() => setShowSettings(true)}
      />
      
      <div className="flex-1 flex flex-col">
        <AssistantHeader
          connectionStatus={connectionStatus}
          selectedModel={selectedModel}
          models={models}
          showModelSelect={showModelSelect}
          setShowModelSelect={setShowModelSelect}
          setSelectedModel={handleModelSelect}
          onOpenSettings={() => setShowSettings(true)}
          onNavigateHome={handleNavigateHome}
        />

        <ChatWindow
          messages={messages}
          showScrollButton={showScrollButton}
          scrollToBottom={scrollToBottom}
          messagesEndRef={messagesEndRef}
          chatContainerRef={chatContainerRef}
          onNewChat={() => handleNewChat()}
          isStreaming={isProcessing}
          showTokens={!isStreaming}
        />

        {showImageWarning && images.length > 0 && (
          <div className="px-6">
            <div className="max-w-3xl mx-auto">
              <ImageWarning onClose={() => setShowImageWarning(false)} />
            </div>
          </div>
        )}

        <ChatInput
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          handleKeyDown={handleKeyDown}
          isDisabled={!client || !selectedModel || (isProcessing && !input.trim())}
          isProcessing={isProcessing}
          onNewChat={() => handleNewChat()}
          onImageUpload={handleImageUpload}
          images={images}
          onRemoveImage={removeImage}
          handleStopStreaming={handleStopStreaming}
        />

        <AssistantSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          isStreaming={isStreaming}
          setIsStreaming={setIsStreaming}
        />

        {showModelWarning && (
          <ModelWarning
            onClose={() => setShowModelWarning(false)}
            onConfirm={() => {
              setShowModelWarning(false);
              handleSend();
            }}
            onCancel={() => {
              setShowModelWarning(false);
              const imageModel = findImageSupportedModel();
              if (imageModel) {
                setSelectedModel(imageModel);
              }
            }}
          />
        )}

        <ModelPullModal
          isOpen={showPullModal}
          onClose={() => setShowPullModal(false)}
          onPullModel={handlePullModel}
        />
      </div>
    </div>
  );
};

export default Assistant;