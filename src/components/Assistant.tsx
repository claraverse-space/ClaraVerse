import React, { useState, useEffect, useRef } from 'react';
import AssistantSidebar from './AssistantSidebar';
import { AssistantHeader, ChatInput, ChatWindow, } from './assistant_components';
import InterpreterChat from './assistant_components/InterpreterChat';
import { useInterpreter } from '../contexts/InterpreterContext';
import { useProviders } from '../contexts/ProvidersContext';

import ImageWarning from './assistant_components/ImageWarning';

import { db } from '../db';
import { AssistantAPIClient } from '../utils';
import type { Chat, Tool } from '../db';
import {
  TemporaryDocument,
  MAX_TEMP_COLLECTIONS,
  getNextTempCollectionName,
  cleanupAllTempCollections
} from './assistantLibrary/tempDocs';
import {
  searchDocuments
} from './assistantLibrary/ragSearch';
import {
  ModelConfig,
  ModelSelectionConfig,
  ApiModelConfig,
  checkModelImageSupport,
  findImageSupportedModel,
  getAppropriateModel
} from './assistantLibrary/modelSelection';
import {
  formatToolForOpenAI,
  executeToolImplementation
} from './assistantLibrary/toolUtils';
import AssistantModals from './AssistantModals';
import { useAssistantChat } from './hooks/useAssistantChat';

// Define model interface based on the API response structure
interface Model {
  name: string;
  id: string;
  digest?: string;
  size?: number;
  modified_at?: string;
}

interface UploadedImage {
  id: string;
  base64: string;
  preview: string;
}

interface AssistantProps {
  onPageChange: (page: string) => void;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Clara Migration Modal Component
const ClaraMigrationModal: React.FC<{ 
  onNavigateToClara: () => void;
  onDismiss: () => void;
}> = ({ onNavigateToClara, onDismiss }) => {
  const [showModal, setShowModal] = useState(() => {
    // Check if user has previously dismissed the modal
    const dismissed = localStorage.getItem('clara_migration_modal_dismissed');
    console.log('Clara Migration Modal - dismissed status:', dismissed);
    
    // For debugging - temporarily clear the dismissed status
    // localStorage.removeItem('clara_migration_modal_dismissed');
    
    const shouldShow = dismissed !== 'true';
    console.log('Clara Migration Modal - should show:', shouldShow);
    return shouldShow;
  });

  console.log('Clara Migration Modal - rendering, showModal:', showModal);

  const handleDismiss = () => {
    console.log('Clara Migration Modal - dismissing');
    setShowModal(false);
    localStorage.setItem('clara_migration_modal_dismissed', 'true');
    onDismiss();
  };

  const handleNavigate = () => {
    console.log('Clara Migration Modal - navigating to Clara');
    localStorage.setItem('clara_migration_modal_dismissed', 'true');
    onDismiss();
    onNavigateToClara();
  };

  if (!showModal) {
    console.log('Clara Migration Modal - not showing because showModal is false');
    return null;
  }

  console.log('Clara Migration Modal - rendering modal content');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" style={{ zIndex: 99999, pointerEvents: 'auto' }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-auto overflow-hidden border border-gray-200 dark:border-gray-700 relative z-[100000]" style={{ zIndex: 100000, pointerEvents: 'auto' }}>
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10 cursor-pointer"
          aria-label="Close modal"
          style={{ pointerEvents: 'auto' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Clara Image */}
        <div className="flex justify-center pt-6 pb-4">
          <div className="relative">
            <img 
              src="/mascot/Tips_Clara.png" 
              alt="Clara" 
              className="w-24 h-24 object-contain"
              onError={(e) => {
                // Fallback to src/assets path if public path fails
                e.currentTarget.src = "/src/assets/mascot/Tips_Clara.png";
              }}
            />
            {/* Speech bubble pointer */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800"></div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-6 pb-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Hi there! 👋
            </h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              We've closed support for this previous chat UI. There's a brand new, more powerful Clara Assistant waiting for you!
            </p>
          </div>

          <div className="bg-gradient-to-r from-sakura-50 to-purple-50 dark:from-sakura-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              ✨ What's New:
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Enhanced AI capabilities</li>
              <li>• Better file processing</li>
              <li>• Improved user experience</li>
              <li>• Advanced tool integration</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm cursor-pointer"
              style={{ pointerEvents: 'auto' }}
            >
              Maybe Later
            </button>
            <button
              onClick={handleNavigate}
              className="flex-1 bg-gradient-to-r from-sakura-500 to-purple-500 hover:from-sakura-600 hover:to-purple-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg cursor-pointer"
              style={{ pointerEvents: 'auto' }}
            >
              Let's Go! 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Assistant: React.FC<AssistantProps> = ({ onPageChange }) => {
  const { isInterpreterMode } = useInterpreter();
  const { primaryProvider, loading: providersLoading } = useProviders();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    // Get stored model for the primary provider
    const providerId = localStorage.getItem('primary_provider_id');
    return providerId ? localStorage.getItem(`selected_model_${providerId}`) || '' : '';
  });
  const [activeAutoModel, setActiveAutoModel] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isStreaming, setIsStreaming] = useState(() => {
    const stored = localStorage.getItem('assistant_streaming');
    return stored === null ? true : stored === 'true';
  });
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [showImageWarning, setShowImageWarning] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showPullModal, setShowPullModal] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [showToolModal, setShowToolModal] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [pythonPort, setPythonPort] = useState<number | null>(null);
  const [temporaryDocs, setTemporaryDocs] = useState<TemporaryDocument[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [useAllTools, setUseAllTools] = useState(false);
  const [useStructuredToolCalling, setUseStructuredToolCalling] = useState(() => {
    // Get stored preference or default to false
    return localStorage.getItem('use_structured_tool_calling') === 'true';
  });
  // const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Check if onboarding has been completed
    const onboardingCompleted = localStorage.getItem('onboarding_completed');
    // Only show if onboarding has never been completed
    return !onboardingCompleted;
  });
  const [modelSelectionConfig, setModelSelectionConfig] = useState<ApiModelConfig>(() => {
    const providerId = primaryProvider?.id;
    const storedConfig = localStorage.getItem(`model_selection_config_${providerId}`);
    
    if (storedConfig) {
      return JSON.parse(storedConfig);
    }
    
    // Default config now sets mode to 'auto'
    return {
      type: 'openai', // All providers are OpenAI-compatible now
      mode: 'auto',
      visionModel: '',
      toolModel: '',
      ragModel: ''
    };
  });

  // Track if Clara migration modal is visible
  const [isClaraMigrationModalVisible, setIsClaraMigrationModalVisible] = useState(() => {
    const dismissed = localStorage.getItem('clara_migration_modal_dismissed');
    console.log('Assistant component - Clara modal dismissed status:', dismissed);
    
    // For debugging - uncomment this line to force show the modal
    localStorage.removeItem('clara_migration_modal_dismissed');
    
    const shouldShow = dismissed !== 'true';
    console.log('Assistant component - Clara modal should show:', shouldShow);
    return shouldShow;
  });

  // Initialize or get temporary collection names from localStorage
  const [tempCollectionNames] = useState(() => {
    const stored = localStorage.getItem('temp_collection_names');
    if (stored) {
      return JSON.parse(stored);
    }
    // Create array of fixed collection names
    const names = Array.from({ length: MAX_TEMP_COLLECTIONS }, (_, i) => `temp_collection_${i + 1}`);
    localStorage.setItem('temp_collection_names', JSON.stringify(names));
    return names;
  });

  // Track current collection index
  useEffect(() => {
    return () => {
      if (temporaryDocs.length > 0) {
        cleanupAllTempCollections(tempCollectionNames, pythonPort);
      }
    };
  }, []);

  const getPythonPort = async () => {
    try {
      if (window.electron && window.electron.getPythonPort) {
        return await window.electron.getPythonPort();
      }
      return null;
    } catch (error) {
      console.error('Could not get Python port:', error);
      return null;
    }
  };

  useEffect(() => {
    getPythonPort().then(port => {
      setPythonPort(port);
    });
  }, []);

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
      } catch {
        console.error(`Failed to process image ${file.name}`);
      }
    }

    setImages(prev => [...prev, ...newImages]);

    // Just show the warning if images are being used
    if (newImages.length > 0) {
      setShowImageWarning(true);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleTemporaryDocUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!pythonPort || !activeChat) return;

    const files = event.target.files;
    if (!files) return;

    // Get next collection name
    const tempCollectionName = getNextTempCollectionName(tempCollectionNames);
    const timestamp = Date.now();
    const uploadedDocs: TemporaryDocument[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('collection_name', tempCollectionName);
        formData.append('metadata', JSON.stringify({
          source: 'temporary_upload',
          chat_id: activeChat,
          timestamp: timestamp
        }));

        const response = await fetch(`http://0.0.0.0:${pythonPort}/documents/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

        uploadedDocs.push({
          id: crypto.randomUUID(),
          name: file.name,
          collection: tempCollectionName,
          timestamp: timestamp
        });
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    if (uploadedDocs.length > 0) {
      setTemporaryDocs(prev => [...prev, ...uploadedDocs]);
      setRagEnabled(true);
    }
  };

  const removeTemporaryDoc = async (docId: string) => {
    setTemporaryDocs(prev => prev.filter(d => d.id !== docId));
  };

  const [client, setClient] = useState<AssistantAPIClient | null>(null);

  const getAppropriateModelForContent = () => {
    // Determine which auto-selected model to show based on content
    if (images.length > 0 && modelSelectionConfig.visionModel) {
      setActiveAutoModel(modelSelectionConfig.visionModel);
      return modelSelectionConfig.visionModel;
    } else if (modelSelectionConfig.toolModel) {
      // Use toolModel for both tool use and normal text
      setActiveAutoModel(modelSelectionConfig.toolModel);
      return modelSelectionConfig.toolModel;
    } else if (ragEnabled && modelSelectionConfig.ragModel) {
      setActiveAutoModel(modelSelectionConfig.ragModel);
      return modelSelectionConfig.ragModel;
    } else if (modelSelectionConfig.mode === 'auto') {
      // Default to the first auto model that's set
      const firstModel = modelSelectionConfig.visionModel || 
                         modelSelectionConfig.toolModel || 
                         modelSelectionConfig.ragModel;
      setActiveAutoModel(firstModel || '');
      return firstModel || selectedModel;
    }
    return selectedModel;
  };

  // Update active model whenever content changes that would affect model selection
  useEffect(() => {
    if (modelSelectionConfig.mode === 'auto') {
      getAppropriateModelForContent();
    }
  }, [images.length, useAllTools, selectedTool, ragEnabled, modelSelectionConfig]);

  // Move this up before any useEffect that uses assistantChat
  const assistantChat = useAssistantChat({
    client,
    selectedModel,
    db,
    modelSelectionConfig,
    tools,
    useAllTools,
    selectedTool,
    images,
    setImages,
    ragEnabled,
    temporaryDocs,
    pythonPort,
    setSelectedModel,
    setChats,
    activeChat,
    setActiveChat,
    scrollToBottom,
    executeToolImplementation,
    formatToolForOpenAI,
    getAppropriateModel,
    checkModelImageSupport,
    findImageSupportedModel,
    searchDocuments,
    useStructuredToolCalling,
    isStreaming,
  });

  // Modified handleSend to use the appropriate model
  const originalHandleSend = assistantChat.handleSend;
  
  const modifiedHandleSend = async () => {
    if (modelSelectionConfig.mode === 'auto') {
      // Update the active model before sending message
      const appropriateModel = getAppropriateModelForContent();
      if (appropriateModel && appropriateModel !== selectedModel) {
        setSelectedModel(appropriateModel);
      }
    }
    
    // Call the original handler
    await originalHandleSend();
  };

  // Override the handleSend function
  assistantChat.handleSend = modifiedHandleSend;

  useEffect(() => {
    return () => {
      temporaryDocs.forEach(doc => {
        removeTemporaryDoc(doc.id).catch(console.error);
      });
    };
  }, [activeChat]);

  useEffect(() => {
    if (activeChat) {
      // No need to cleanup here, temp docs should persist across chat changes
    }
  }, [activeChat]);

  useEffect(() => {
    // Check for pending chat query from search bar
    const pendingQuery = localStorage.getItem('pending_chat_query');
    if (pendingQuery) {
      // Clear the pending query
      localStorage.removeItem('pending_chat_query');
      // Set the input
      assistantChat.setInput(pendingQuery);
      // Create a new chat and send the message
      handleNewChat(pendingQuery);
    }
  }, []); // Run only once on component mount

  useEffect(() => {
    const loadChatMessages = async () => {
      if (activeChat) {
        try {
          const chatMessages = await db.getChatMessages(activeChat);
          assistantChat.setMessages(chatMessages);
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
    if (assistantChat.messages.length > 0) {
      scrollToBottom('auto');
    }
  }, [assistantChat.messages]);

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
        assistantChat.setMessages(chatMessages);
      } else {
        // Create a new chat if none exist
        handleNewChat();
      }
    };
    loadInitialChat();
  }, []);

  // Load tools on component mount
  useEffect(() => {
    const loadTools = async () => {
      try {
        const availableTools = await db.getAllTools();
        setTools(availableTools.filter(tool => tool.isEnabled));
      } catch (error) {
        console.error('Error loading tools:', error);
      }
    };
    loadTools();
  }, []);

  const getMostUsedModel = async (availableModels: Model[]): Promise<string | null> => {
    try {
      // Get model usage statistics from the database
      const modelUsage = await db.getModelUsage();

      if (!modelUsage || Object.keys(modelUsage).length === 0) {
        return null;
      }

      // Filter to only include currently available models
      const availableModelNames = availableModels.map(model => model.name);
      const validUsageEntries = Object.entries(modelUsage)
        .filter(([modelName]) => {
          return availableModelNames.includes(modelName);
        });

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
    const initializeProvider = async () => {
      if (!primaryProvider || providersLoading) {
        setConnectionStatus('disconnected');
        return;
      }

      try {
        const newClient = new AssistantAPIClient(primaryProvider.baseUrl || '', {
          apiKey: primaryProvider.apiKey || '',
          providerId: primaryProvider.id // Pass provider ID for tool error tracking
        });
        setClient(newClient);

        // Load saved model selection config for current provider
        const savedModelSelectionConfig = localStorage.getItem(`model_selection_config_${primaryProvider.id}`);
        if (savedModelSelectionConfig) {
          const parsedConfig = JSON.parse(savedModelSelectionConfig);
          setModelSelectionConfig(parsedConfig);
          
          if (parsedConfig.mode === 'auto') {
            const modelConfig: ModelConfig = {
              visionModel: parsedConfig.visionModel,
              toolModel: parsedConfig.toolModel,
              ragModel: parsedConfig.ragModel
            };
            newClient.setModelConfig(modelConfig);
          }
        } else {
          // If no config exists for this provider, create default
          const defaultConfig: ApiModelConfig = {
            type: 'openai',
            mode: 'manual',
            visionModel: '',
            toolModel: '',
            ragModel: ''
          };
          setModelSelectionConfig(defaultConfig);
          localStorage.setItem(`model_selection_config_${primaryProvider.id}`, JSON.stringify(defaultConfig));
          setShowModelConfig(true);
        }

        // Test connection and get model list
        const modelList = await newClient.listModels();
        setModels(modelList);

        // If no model is selected, try to select one automatically
        if (!selectedModel) {
          // First try to get the most used model for the current provider
          const mostUsed = await getMostUsedModel(modelList);
          if (mostUsed) {
            handleModelSelect(mostUsed);
          } else {
            // If no most used model, select the first available model
            const defaultModel = modelList[0]?.name;
            if (defaultModel) {
              handleModelSelect(defaultModel);
            }
          }
        }

        // Update selected model based on provider
        const storedModel = localStorage.getItem(`selected_model_${primaryProvider.id}`);
        
        if (storedModel && modelList.some(m => m.name === storedModel)) {
          setSelectedModel(storedModel);
        } else if (modelList.length > 0) {
          // If stored model not found in current list, select first available
          handleModelSelect(modelList[0].name);
        }

        setConnectionStatus('connected');
      } catch (err) {
        console.error('Failed to connect to provider:', err);
        setConnectionStatus('disconnected');
      }
    };

    initializeProvider();
  }, [primaryProvider, providersLoading]);

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
    // Store model selection based on provider ID
    if (primaryProvider?.id) {
      localStorage.setItem(`selected_model_${primaryProvider.id}`, modelName);
    }
  };

  const handleModelConfigSave = (config: ModelSelectionConfig) => {
    if (!primaryProvider?.id) return;
    
    const fullConfig: ApiModelConfig = {
      ...config,
      type: 'openai' // All providers are OpenAI-compatible
    };

    setModelSelectionConfig(fullConfig);
    localStorage.setItem(`model_selection_config_${primaryProvider.id}`, JSON.stringify(fullConfig));
    
    // Mark onboarding as completed
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
    
    // If auto mode, set the model config for the client
    if (config.mode === 'auto' && client) {
      const modelConfig: ModelConfig = {
        visionModel: config.visionModel,
        toolModel: config.toolModel,
        ragModel: config.ragModel
      };
      client.setModelConfig(modelConfig);
    }
  };

  const handleNewChat = async (initialMessage?: string) => {
    // Create chat with a temporary name - it will be updated after first message
    const chatId = await db.createChat(initialMessage?.slice(0, 50) || 'New Chat');
    setActiveChat(chatId);

    const welcomeMessage = {
      id: crypto.randomUUID(),
      chat_id: chatId,
      content: "Hello! How can I help you today?",
      role: 'assistant' as const,
      timestamp: Date.now(),
      tokens: 0
    };

    await db.addMessage(
      chatId,
      welcomeMessage.content,
      welcomeMessage.role,
      welcomeMessage.tokens || 0
    );

    assistantChat.setMessages([welcomeMessage]);
    const updatedChats = await db.getRecentChats();
    setChats(updatedChats);

    if (initialMessage) {
      assistantChat.setInput(initialMessage);
      setTimeout(() => assistantChat.handleSend(), 100);
    }
  };

  const handleStopStreaming = () => {
    if (!client || !assistantChat.isProcessing) return;

    try {
      // Abort the current stream
      client.abortStream();

      // Update the UI to show that streaming has stopped
      setIsStreaming(false);
    } catch (error) {
      console.warn('Error stopping stream:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      assistantChat.handleSend();
    }
  };

  const handleToggleStructuredToolCalling = () => {
    const newValue = !useStructuredToolCalling;
    setUseStructuredToolCalling(newValue);
    localStorage.setItem('use_structured_tool_calling', newValue.toString());
  };

  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadWallpaper = async () => {
      try {
        const wallpaper = await db.getWallpaper();
        if (wallpaper) {
          setWallpaperUrl(wallpaper);
        }
      } catch (error) {
        console.error('Error loading wallpaper:', error);
      }
    };
    loadWallpaper();
  }, []);

  const [showModelConfig, setShowModelConfig] = useState(false);

  // Handler to navigate to the new Clara assistant
  const handleNavigateToClara = () => {
    console.log('Navigating to Clara assistant');
    onPageChange('clara');
  };

  console.log('Assistant component rendering - isClaraMigrationModalVisible:', isClaraMigrationModalVisible);

  return (
    <div className="relative flex h-screen bg-gradient-to-br from-white to-sakura-100 dark:from-gray-900 dark:to-sakura-100/10">
      {/* Clara Migration Modal */}
      <ClaraMigrationModal onNavigateToClara={handleNavigateToClara} onDismiss={() => setIsClaraMigrationModalVisible(false)} />
      
      {/* Debug div to test rendering */}
      {isClaraMigrationModalVisible && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-2 rounded z-[99998]">
          DEBUG: Modal should be visible
        </div>
      )}
      
      {/* Wallpaper */}
      {wallpaperUrl && (
        <div 
          className="absolute top-0 left-0 right-0 bottom-0 z-0"
          style={{
            backgroundImage: `url(${wallpaperUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
            filter: 'blur(1px)',
            pointerEvents: 'none'
          }}
        />
      )}
      {/* Only show sidebar when not in interpreter mode */}
      {!isInterpreterMode && (
        <div style={{ pointerEvents: isClaraMigrationModalVisible ? 'none' : 'auto' }}>
          <AssistantSidebar
            activeChat={activeChat}
            onChatSelect={setActiveChat}
            chats={chats}
            onOpenSettings={() => setShowSettings(true)}
            onNavigateHome={handleNavigateHome}
          />
        </div>
      )}

      <div className={`flex-1 flex flex-col ${isInterpreterMode ? 'pl-0' : ''}`} style={{ pointerEvents: isClaraMigrationModalVisible ? 'none' : 'auto' }}>
        {!isInterpreterMode ? (
          <>
            <AssistantHeader
              connectionStatus={connectionStatus}
              onPageChange={onPageChange}
              onNavigateHome={handleNavigateHome}
              onOpenSettings={() => setShowSettings(true)}
              onOpenKnowledgeBase={() => setShowKnowledgeBase(true)}
              onOpenTools={() => setShowToolModal(true)}
            />

            <ChatWindow
              messages={assistantChat.messages}
              showScrollButton={showScrollButton}
              scrollToBottom={scrollToBottom}
              messagesEndRef={messagesEndRef}
              chatContainerRef={chatContainerRef}
              onNewChat={() => handleNewChat()}
              isStreaming={assistantChat.isProcessing}
              showTokens={!assistantChat.isProcessing}
              onRetryMessage={assistantChat.handleRetryMessage}
              onEditMessage={assistantChat.handleEditMessage}
              onSendEdit={assistantChat.handleSendEdit}
            />
          </>
        ) : (
          // Interpreter mode - completely different layout
          <div className="flex-1 flex flex-col h-full">
            <InterpreterChat />
          </div>
        )}

        <ChatInput
          input={assistantChat.input}
          setInput={assistantChat.setInput}
          handleSend={assistantChat.handleSend}
          handleKeyDown={handleKeyDown}
          isDisabled={!client || !selectedModel || (assistantChat.isProcessing && !assistantChat.input.trim())}
          isProcessing={assistantChat.isProcessing}
          onNewChat={() => handleNewChat()}
          onImageUpload={handleImageUpload}
          images={images}
          onRemoveImage={removeImage}
          handleStopStreaming={handleStopStreaming}
          ragEnabled={ragEnabled}
          onToggleRag={setRagEnabled}
          onTemporaryDocUpload={handleTemporaryDocUpload}
          temporaryDocs={temporaryDocs}
          onRemoveTemporaryDoc={removeTemporaryDoc}
          tools={tools}
          onToolSelect={setSelectedTool}
          useAllTools={useAllTools}
          onUseAllToolsChange={setUseAllTools}
          models={models}
          onModelConfigSave={handleModelConfigSave}
          modelConfig={modelSelectionConfig}
          onModelSelect={handleModelSelect}
          useStructuredToolCalling={useStructuredToolCalling}
          onToggleStructuredToolCalling={handleToggleStructuredToolCalling}
          selectedModel={selectedModel}
          activeAutoModel={activeAutoModel}
        />

        {showImageWarning && images.length > 0 && !isClaraMigrationModalVisible && (
          <div className="px-6">
            <div className="max-w-3xl mx-auto">
              <ImageWarning onClose={() => setShowImageWarning(false)} />
            </div>
          </div>
        )}

        {!isClaraMigrationModalVisible && (
          <AssistantModals
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            isStreaming={isStreaming}
            setIsStreaming={setIsStreaming}
            showPullModal={showPullModal}
            setShowPullModal={setShowPullModal}
            showKnowledgeBase={showKnowledgeBase}
            setShowKnowledgeBase={setShowKnowledgeBase}
            showToolModal={showToolModal}
            setShowToolModal={setShowToolModal}
            client={client}
            selectedModel={selectedModel}
            models={models}
            showModelConfig={showModelConfig}
            setShowModelConfig={setShowModelConfig}
            handleModelConfigSave={handleModelConfigSave}
            modelSelectionConfig={modelSelectionConfig}
            showOnboarding={showOnboarding}
            setShowOnboarding={setShowOnboarding}
          />
        )}
      </div>
    </div>
  );
};

export default Assistant;