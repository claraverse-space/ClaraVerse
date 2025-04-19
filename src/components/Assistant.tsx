import React, { useState, useEffect, useRef } from 'react';
import AssistantSidebar from './AssistantSidebar';
import { AssistantHeader, ChatInput, ChatWindow, KnowledgeBaseModal, ToolModal } from './assistant_components';
import AssistantSettings from './assistant_components/AssistantSettings';
import ImageWarning from './assistant_components/ImageWarning';
import ModelPullModal from './assistant_components/ModelPullModal';
import { db } from '../db';
import { AssistantOllamaClient, ChatMessage, ChatRole } from '../utils';
import type { Message, Chat, Tool } from '../db';
import type { ElectronAPI } from '../types/electron';
import { v4 as uuidv4 } from 'uuid';

// Add RequestOptions type definition
interface RequestOptions {
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Tool[];
  [key: string]: any;
}

interface UploadedImage {
  id: string;
  base64: string;
  preview: string;
}

interface TemporaryDocument {
  id: string;
  name: string;
  collection: string;
  timestamp: number; // Add timestamp for tracking
}

interface AssistantProps {
  onPageChange: (page: string) => void;
}

interface ToolResult {
  name: string;
  result: string;
}

interface SearchResult {
  score: number;
  content: string;
}

interface SearchResponse {
  results: SearchResult[];
}

const MAX_CONTEXT_MESSAGES = 20;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEMP_COLLECTIONS = 5; // Maximum number of temporary collections

const ensureChatMessageFormat = (messages: any[]): ChatMessage[] => {
  return messages.map(msg => ({
    role: (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user') as ChatRole,
    content: msg.content || ''
  }));
};

const Assistant: React.FC<AssistantProps> = ({ onPageChange }) => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
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
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

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
  const [currentTempCollectionIndex, setCurrentTempCollectionIndex] = useState(() => {
    const stored = localStorage.getItem('current_temp_collection_index');
    return stored ? parseInt(stored) : 0;
  });

  const getNextTempCollectionName = () => {
    const nextIndex = (currentTempCollectionIndex + 1) % MAX_TEMP_COLLECTIONS;
    setCurrentTempCollectionIndex(nextIndex);
    localStorage.setItem('current_temp_collection_index', nextIndex.toString());
    return tempCollectionNames[nextIndex];
  };

  const cleanupTempCollection = async (collectionName: string) => {
    if (!pythonPort) return;

    try {
      // Delete the collection through the API
      await fetch(`http://0.0.0.0:${pythonPort}/collections/${collectionName}`, {
        method: 'DELETE'
      });
      
      console.log(`Successfully cleaned up collection: ${collectionName}`);
    } catch (error) {
      console.error('Error cleaning up temporary collection:', error);
    }
  };

  const cleanupAllTempCollections = async () => {
    if (!pythonPort) return;

    for (const collectionName of tempCollectionNames) {
      await cleanupTempCollection(collectionName);
    }
  };

  // Add cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      if (temporaryDocs.length > 0) {
        cleanupAllTempCollections();
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

    // Just show the warning if images are being used
    if (newImages.length > 0) {
      setShowImageWarning(true);
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleTemporaryDocUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!pythonPort || !activeChat) return;

    const files = event.target.files;
    if (!files) return;

    // Get next collection name
    const tempCollectionName = getNextTempCollectionName();
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

  const [modelConfig, setModelConfig] = useState({
    visionModel: '',
    toolModel: '',
    ragModel: ''
  });

  // Replace OllamaClient with AssistantOllamaClient
  const [client, setClient] = useState<AssistantOllamaClient | null>(null);

  useEffect(() => {
    const initializeOllama = async () => {
      const config = await db.getAPIConfig();
      if (!config) {
        setConnectionStatus('disconnected');
        return;
      }

      try {
        let baseUrl: string;
        let clientConfig: any = {};

        if (config.api_type === 'ollama') {
          baseUrl = config.ollama_base_url || 'http://localhost:11434';
          clientConfig = { type: 'ollama' };
        } else {
          baseUrl = config.api_type === 'openai' 
            ? 'https://api.openai.com/v1'
            : config.ollama_base_url || 'http://localhost:11434';

          clientConfig = {
            type: config.api_type || 'ollama',
            apiKey: config.openai_api_key || ''
          };
        }

        const newClient = new AssistantOllamaClient(baseUrl, clientConfig);
        setClient(newClient);

        // Load saved model config
        const savedModelConfig = localStorage.getItem('assistant_model_config');
        if (savedModelConfig) {
          const config = JSON.parse(savedModelConfig);
          setModelConfig(config);
          newClient.setModelConfig(config);
        }

        // Test connection and get model list
        const modelList = await newClient.listModels();
        setModels(modelList);

        // Show model pull modal if we're connected to Ollama but have no models
        if (config.api_type === 'ollama' && modelList.length === 0) {
          setShowPullModal(true);
        }

        // If no model is selected, try to select one automatically
        if (!selectedModel) {
          // First try to get the most used model
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

        setConnectionStatus('connected');
      } catch (err) {
        console.error('Failed to connect to API:', err);
        setConnectionStatus('disconnected');
      }
    };

    initializeOllama();
  }, []);

  const handleModelConfigSave = (config: {
    visionModel: string;
    toolModel: string;
    ragModel: string;
  }) => {
    setModelConfig(config);
    localStorage.setItem('assistant_model_config', JSON.stringify(config));
    if (client) {
      client.setModelConfig(config);
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

    setMessages([welcomeMessage]);
    const updatedChats = await db.getRecentChats();
    setChats(updatedChats);

    if (initialMessage) {
      setInput(initialMessage);
      setTimeout(() => handleSend(), 100);
    }
  };

  const getContextMessages = (messages: Message[], useTool: boolean = false): Message[] => {
    // For tool calls, only get the last message for context
    if (useTool) {
      return messages.slice(-1);
    }
    // For normal chat, get the last MAX_CONTEXT_MESSAGES messages
    return messages.slice(-MAX_CONTEXT_MESSAGES);
  };

  const formatMessagesForModel = async (messages: Message[]): Promise<{ role: string; content: string }[]> => {
    // Get system prompt
    const systemPrompt = await db.getSystemPrompt();

    // Create messages array with system prompt first if it exists
    const formattedMessages = [];

    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add the rest of the messages
    formattedMessages.push(
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    );

    return formattedMessages;
  };

  const searchDocuments = async (query: string): Promise<SearchResponse | null> => {
    if (!pythonPort) return null;

    try {
      // If there are temporary documents, only use temp collections
      if (temporaryDocs.length > 0) {
        const tempResults = await Promise.all(
          temporaryDocs.map(async (doc) => {
            try {
              const response = await fetch(`http://0.0.0.0:${pythonPort}/documents/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query,
                  collection_name: doc.collection,
                  k: 8,
                }),
              });
              
              if (!response.ok) {
                console.warn(`Search failed for collection ${doc.collection}:`, response.status);
                return { results: [] };
              }
              
              return await response.json() as SearchResponse;
            } catch (error) {
              console.warn(`Search error for collection ${doc.collection}:`, error);
              return { results: [] };
            }
          })
        );

        // For temp docs, use all results regardless of score
        const allTempResults = tempResults.flatMap(r => r.results || []);

        // Sort by score and return
        return {
          results: allTempResults
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 8)
        };
      }

      // If RAG is enabled and no temp docs, use only clara-assistant collection
      if (ragEnabled) {
        try {
          const response = await fetch(`http://0.0.0.0:${pythonPort}/documents/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              collection_name: 'clara-assistant',
              k: 8,
            }),
          });

          if (response.ok) {
            const defaultResults = await response.json() as SearchResponse;
            // Filter results by score > 0
            return {
              results: (defaultResults?.results || [])
                .filter(result => (result.score || 0) > 0)
                .slice(0, 8)
            };
          } else {
            console.warn('Clara Assistant collection search failed:', response.status);
            return { results: [] };
          }
        } catch (error) {
          console.warn('Clara Assistant collection search error:', error);
          return { results: [] };
        }
      }

      // If neither temp docs nor RAG enabled, return empty results
      return { results: [] };
    } catch (error) {
      console.error('Error searching documents:', error);
      return { results: [] };
    }
  };

  const handleSearch = async () => {
    if (!input.trim()) return;

    const results = await searchDocuments(input);
    if (results && results.results) {
      setSearchResults(results);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !client || !selectedModel || isProcessing) return;

    // Store original model to switch back after image processing
    const originalModel = selectedModel;

    // If using images, automatically switch to image-supported model if needed
    if (images.length > 0 && !checkModelImageSupport(selectedModel)) {
      const imageModel = findImageSupportedModel();
      if (imageModel) {
        setSelectedModel(imageModel);
      }
      // Proceed even if no image model is found - will use current model
    }

    let currentChatId = activeChat;
    if (!currentChatId) {
      const chatName = input.length > 50 ? input.slice(0, 50) + '...' : input;
      currentChatId = await db.createChat(chatName);
      setActiveChat(currentChatId);
    } else {
      const currentChats = await db.getRecentChats();
      const thisChat = currentChats.find(c => c.id === currentChatId);
      if (thisChat && thisChat.title === 'New Chat') {
        const newTitle = input.length > 50 ? input.slice(0, 50) + '...' : input;
        await db.updateChat(currentChatId, { title: newTitle });
        const updatedChats = await db.getRecentChats();
        setChats(updatedChats);
      }
    }

    // Create user message (keeping the original user input for display)
    const userMessage: Message = {
      id: uuidv4(),
      chat_id: currentChatId,
      content: input,
      role: 'user' as ChatRole,
      timestamp: Date.now(),
      tokens: 0,
      images: images.map(img => img.preview)
    };

    // Save user message as-is (without RAG context)
    await db.addMessage(
      currentChatId,
      userMessage.content,
      userMessage.role,
      0,
      userMessage.images
    );

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImages([]);

    // Create initial placeholder message
    const assistantMessage: Message = {
      id: uuidv4(),
      chat_id: currentChatId,
      content: '',
      role: 'assistant' as ChatRole,
      timestamp: Date.now(),
      tokens: 0
    };

    try {
      setIsProcessing(true);
      const startTime = performance.now();

      // Add placeholder immediately
      setMessages(prev => [...prev, assistantMessage]);

      // Define chat options
      const chatOptions: RequestOptions = {
        temperature: 0.7,
        top_p: 0.9
      };

      if (images.length > 0) {
        // Handle image generation
        try {
          const response = await client.generateWithImages(
            selectedModel,
            input,
            images.map(img => img.base64),
            chatOptions
          );

          const content = response.response || '';
          const tokens = response.eval_count || 0;

          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content, tokens }
              : msg
          ));

          await db.addMessage(currentChatId, content, 'assistant', tokens);

          // Switch back to original model after image processing
          if (originalModel !== selectedModel) {
            setSelectedModel(originalModel);
          }
          return;
        } catch (error: unknown) {
          console.error('Image generation error:', error);
          throw error;
        }
      }

      // Get context messages - use minimal context for tool calls
      const contextMessages = getContextMessages([...messages, userMessage], !!selectedTool);
      
      // Check if we need to do RAG search and inject into user query
      let userContentWithContext = userMessage.content;
      if ((temporaryDocs.length > 0 || ragEnabled) && pythonPort) {
        const results = await searchDocuments(input);
        if (results && results.results && results.results.length > 0) {
          const contextFromSearch = results.results
            .map(r => r.content)
            .join('\n\n');
          
          // Inject context into user query (this won't be displayed in the UI)
          userContentWithContext = `Query: ${input}\n\nRelevant context:\n${contextFromSearch}\n\nPlease use this context to inform your response, but do not explicitly mention the provided context unless specifically asked.`;
        }
      }
      
      // Map context messages, replacing the last user message with the context-enhanced version
      const formattedMessages: ChatMessage[] = [
        { role: 'system' as ChatRole, content: await db.getSystemPrompt() }
      ];
      
      contextMessages.forEach((msg, index) => {
        // If this is the most recent user message (the one we just added), use the context-enhanced version
        if (index === contextMessages.length - 1 && msg.role === 'user') {
          formattedMessages.push({
            role: 'user' as ChatRole,
            content: userContentWithContext
          });
        } else {
          formattedMessages.push({
            role: (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' 
              ? msg.role 
              : 'user') as ChatRole,
            content: msg.content
          });
        }
      });

      if (selectedTool) {
        // Format tool differently based on API type
        const formattedTool = client.getConfig().type === 'openai' 
          ? {
              ...selectedTool,
              type: 'function',
              function: {
                name: selectedTool.name,
                description: selectedTool.description,
                parameters: {
                  type: 'object',
                  properties: selectedTool.parameters.reduce((acc: any, param: any) => {
                    acc[param.name] = {
                      type: param.type.toLowerCase(),
                      description: param.description
                    };
                    return acc;
                  }, {}),
                  required: selectedTool.parameters
                    .filter((param: any) => param.required)
                    .map((param: any) => param.name)
                }
              }
            }
          : selectedTool;

        chatOptions.tools = [formattedTool];
      } else if (tools.length > 0) {
        // If no specific tool is selected but tools exist, format all enabled tools
        const formattedTools = tools
          .filter(tool => tool.isEnabled)
          .map(tool => 
            client.getConfig().type === 'openai' 
              ? {
                  ...tool,
                  type: 'function',
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: {
                      type: 'object',
                      properties: tool.parameters.reduce((acc: any, param: any) => {
                        acc[param.name] = {
                          type: param.type.toLowerCase(),
                          description: param.description
                        };
                        return acc;
                      }, {}),
                      required: tool.parameters
                        .filter((param: any) => param.required)
                        .map((param: any) => param.name)
                    }
                  }
                }
              : tool
          );

        if (formattedTools.length > 0) {
          chatOptions.tools = formattedTools;
        }
      }
      
      try {
        // Update status: Clara decided to use tool
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: selectedTool 
                ? `Clara decided to use tool - ${selectedTool.name}...`
                : chatOptions.tools?.length 
                  ? `Clara is analyzing which tool(s) to use...`
                  : msg.content }
            : msg
        ));

        // Use sendChatWithToolsPreserveFormat for OpenAI to get raw response format
        const response = client.getConfig().type === 'openai'
          ? await client.sendChatWithToolsPreserveFormat(selectedModel, ensureChatMessageFormat(formattedMessages), chatOptions, chatOptions.tools)
          : await client.sendChat(selectedModel, ensureChatMessageFormat(formattedMessages), chatOptions, chatOptions.tools);
        
        // Handle OpenAI tool calls
        if (client.getConfig().type === 'openai') {
          if (response.choices && response.choices.length > 0) {
            const message = response.choices[0].message;
            
            if (message.tool_calls && message.tool_calls.length > 0) {
              // Handle multiple tool calls sequentially
              const toolResults = [];
              
              for (const toolCall of message.tool_calls) {
                const toolArgs = JSON.parse(toolCall.function.arguments);
                
                // Find the corresponding tool
                const selectedTool = tools.find(t => t.name === toolCall.function.name);
                if (!selectedTool) {
                  console.error(`Tool ${toolCall.function.name} not found`);
                  continue;
                }

                // Update status: Tool is responding
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: `Clara is using tool - ${selectedTool.name}...` }
                    : msg
                ));
                
                let toolResult: any = {};
                  
                try {
                  // Create a safe execution environment for the tool
                  const func = new Function('args', `
                    ${selectedTool.implementation}
                    return implementation(args);
                  `);
                  toolResult = await func(toolArgs);
                } catch (implError: unknown) {
                  toolResult = { 
                    error: `Error executing ${selectedTool.name}: ${implError instanceof Error ? implError.message : String(implError)}` 
                  };
                }

                toolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify(toolResult)
                });
              }
              
              // Update status: Clara is summarizing
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: `Clara is working on summarizing the results...` }
                  : msg
              ));
              
              // Create new messages array with all tool results
              const messagesWithToolResults = [
                ...formattedMessages,
                {
                  role: 'assistant' as ChatRole,
                  content: '',
                  tool_calls: message.tool_calls
                },
                ...toolResults.map(result => ({
                  role: 'tool' as ChatRole,
                  content: result.content,
                  tool_call_id: result.tool_call_id,
                  name: result.name
                }))
              ];
              
              // Get final response with all tool results
              const finalResponse = await client.sendChatWithToolsPreserveFormat(
                selectedModel, 
                messagesWithToolResults, 
                { temperature: 0.7, top_p: 0.9 }
              );
              
              const content = finalResponse.choices?.[0]?.message?.content || 
                'Error: No content received after tool execution';
              const tokens = finalResponse.usage?.total_tokens || 0;
              
              // Update message with final content
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, content, tokens }
                  : msg
              ));
              
              await db.addMessage(currentChatId, content, 'assistant', tokens);
            } else {
              // Handle normal response (no tool calls)
              const content = message.content || 'No response content';
              const tokens = response.usage?.total_tokens || 0;
              
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, content, tokens }
                  : msg
              ));
              
              await db.addMessage(currentChatId, content, 'assistant', tokens);
            }
          } else {
            const errorMessage = 'Unexpected response from OpenAI API';
            
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessage.id
                ? { ...msg, content: errorMessage }
                : msg
            ));
            
            await db.addMessage(currentChatId, errorMessage, 'assistant', 0);
          }
        } else {
          // Handle Ollama response
          const content = response.message?.content || '';
          const tokens = response.eval_count || 0;

          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content, tokens }
              : msg
          ));

          await db.addMessage(currentChatId, content, 'assistant', tokens);
        }
      } catch (toolError: unknown) {
        console.error("Tool execution error:", toolError);
        const errorMessage = `Error executing tool: ${toolError instanceof Error ? toolError.message : String(toolError)}`;
        
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: errorMessage }
            : msg
        ));
        
        await db.addMessage(currentChatId, errorMessage, 'assistant', 0);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      await db.updateModelUsage(selectedModel, duration);
      await db.updateUsage('response_time', duration);

      scrollToBottom();

    } catch (error: unknown) {
      console.error('Error generating response:', error);
      let errorContent;
      try {
        if (typeof error === 'object' && error !== null && 'message' in error) {
          try {
            const parsedError = JSON.parse((error as Error).message);
            errorContent = `Error Response:\n\`\`\`json\n${JSON.stringify(parsedError, null, 2)}\n\`\`\``;
          } catch (e) {
            errorContent = `Error: ${(error as Error).message}`;
          }
        } else {
          errorContent = `Error: ${String(error)}`;
        }
      } catch (e) {
        errorContent = `Error: ${String(error)}`;
      }

      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id
          ? { ...msg, content: errorContent }
          : msg
      ));

      await db.addMessage(
        currentChatId,
        errorContent,
        'assistant',
        0
      );
    } finally {
      setIsProcessing(false);
      setSelectedTool(null); // Reset selected tool after use
    }
  };

  const handleStopStreaming = () => {
    if (!client || !isProcessing) return;

    try {
      // Abort the current stream
      client.abortStream();

      // Update the UI to show that streaming has stopped
      setIsProcessing(false);
    } catch (error) {
      console.warn('Error stopping stream:', error);
    }
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

      // Refresh model list and update selected model
      const modelList = await client.listModels();
      setModels(modelList);
      handleModelSelect(modelName);
      
      // Force close model selector dropdown
      setShowModelSelect(false);
      
      // Show success message
      const message: Message = {
        id: uuidv4(),
        chat_id: activeChat || '',
        content: `Model "${modelName}" has been successfully installed and selected. You can now start using it for your conversations.`,
        role: 'assistant' as ChatRole,
        timestamp: Date.now(),
        tokens: 0
      };

      // Add message to database and state
      if (activeChat) {
        await db.addMessage(
          activeChat,
          message.content,
          message.role,
          message.tokens || 0
        );
      }
      setMessages(prev => [...prev, message]);

      // Force a re-render of the header by updating the models list again
      setTimeout(() => {
        setModels([...modelList]);
      }, 100);
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  };

  const handleRetryMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex < 1 || !client || !selectedModel) return;

    try {
      setIsProcessing(true);

      // Create new assistant message with the same ID
      const assistantMessage: Message = {
        id: messageId,
        chat_id: activeChat!,
        content: '',
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };

      // Update UI first
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? assistantMessage : msg
      ));

      // Get context messages
      const contextMessages = getContextMessages([...messages.slice(0, messageIndex)]);
      const formattedMessages = await formatMessagesForModel(contextMessages);

      let responseContent = '';
      let responseTokens = 0;

      if (isStreaming) {
        for await (const chunk of client.streamChat(selectedModel, ensureChatMessageFormat(formattedMessages))) {
          if (chunk.message?.content) {
            responseContent += chunk.message.content;
            responseTokens = chunk.eval_count || responseTokens;

            setMessages(prev => prev.map(msg =>
              msg.id === messageId
                ? { ...msg, content: responseContent, tokens: responseTokens }
                : msg
            ));

            scrollToBottom();
          }
        }
      } else {
        const response = await client.sendChat(selectedModel, ensureChatMessageFormat(formattedMessages));
        responseContent = response.message?.content || '';
        responseTokens = response.eval_count || 0;

        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: responseContent, tokens: responseTokens }
            : msg
        ));
      }

      // Save changes to database
      try {
        await db.updateMessage(messageId, {
          content: responseContent,
          tokens: responseTokens,
          timestamp: Date.now()
        });
      } catch (dbError) {
        console.warn('Failed to update message in database:', dbError);
        // Continue execution - UI is already updated
      }

    } catch (error: any) {
      console.error('Error retrying message:', error);
      const errorContent = error.message || 'An unexpected error occurred';

      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: `Error: ${errorContent}` }
          : msg
      ));

      try {
        await db.updateMessage(messageId, {
          content: `Error: ${errorContent}`,
          tokens: 0,
          timestamp: Date.now()
        });
      } catch (dbError) {
        console.warn('Failed to save error message to database:', dbError);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex < 0 || !client || !selectedModel) return;

    // Create updated user message
    const updatedMessage = {
      ...messages[messageIndex],
      content: newContent
    };

    // Update the edited message in UI and database
    setMessages(prev => [...prev.slice(0, messageIndex), updatedMessage]);
    await db.updateMessage(messageId, {
      content: newContent
    });

    try {
      setIsProcessing(true);

      // Get context messages including the edited message
      const contextMessages = getContextMessages([...messages.slice(0, messageIndex), updatedMessage]);
      const formattedMessages = await formatMessagesForModel(contextMessages);

      // Create new assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        chat_id: activeChat!,
        content: '',
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };

      // Add placeholder message
      setMessages(prev => [...prev.slice(0, messageIndex + 1), assistantMessage]);

      let responseContent = '';
      let responseTokens = 0;

      if (isStreaming) {
        // Handle streaming response
        for await (const chunk of client.streamChat(selectedModel, ensureChatMessageFormat(formattedMessages))) {
          if (chunk.message?.content) {
            responseContent += chunk.message.content;
            responseTokens = chunk.eval_count || responseTokens;

            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessage.id
                ? { ...msg, content: responseContent, tokens: responseTokens }
                : msg
            ));

            scrollToBottom();
          }
        }
      } else {
        // Handle non-streaming response
        const response = await client.sendChat(selectedModel, ensureChatMessageFormat(formattedMessages));
        responseContent = response.message?.content || '';
        responseTokens = response.eval_count || 0;

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: responseContent, tokens: responseTokens }
            : msg
        ));
      }

      // Save assistant response to database
      await db.addMessage(
        activeChat!,
        responseContent,
        'assistant',
        responseTokens
      );

    } catch (error: any) {
      console.error('Error generating edited response:', error);
      const errorContent = error.message || 'An unexpected error occurred';

      setMessages(prev => prev.map(msg =>
        msg.role === 'assistant'
          ? { ...msg, content: `Error: ${errorContent}` }
          : msg
      ));

    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendEdit = async (messageId: string, newContent: string) => {
    console.log('Handling edit submission:', messageId, newContent);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex < 0 || !client || !selectedModel || !activeChat) return;

    // Prevent processing if content is the same
    if (messages[messageIndex].content === newContent) {
      console.log('No changes made to message');
      return;
    }

    try {
      setIsProcessing(true);

      // Create updated user message for UI
      const updatedMessage = {
        ...messages[messageIndex],
        content: newContent,
        timestamp: Date.now()
      };

      // Update UI state first - only show up to the edited message
      setMessages(prev => [...prev.slice(0, messageIndex), updatedMessage]);

      // Try database update but don't block progress if it fails
      try {
        // Skip database update for now and just use a new message
        // This bypasses the problematic update operation
        await db.deleteMessage(messageId).catch(e => console.warn('Delete failed:', e));
        await db.addMessage(
          activeChat,
          newContent,
          'user',
          updatedMessage.tokens || 0,
          updatedMessage.images
        );
        console.log('Successfully replaced message in database');
      } catch (dbError) {
        console.warn('Database update failed, continuing anyway:', dbError);
        // Continue with UI update regardless of DB success
      }

      // Create assistant placeholder message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        chat_id: activeChat,
        content: '',
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };

      // Add placeholder to UI
      setMessages(prev => [...prev, assistantMessage]);

      // Get context messages from UI state for processing
      const contextMessages = getContextMessages([...messages.slice(0, messageIndex), updatedMessage]);
      const formattedMessages = await formatMessagesForModel(contextMessages);

      // Process response
      let responseContent = '';
      let responseTokens = 0;

      if (isStreaming) {
        for await (const chunk of client.streamChat(selectedModel, ensureChatMessageFormat(formattedMessages))) {
          if (chunk.message?.content) {
            responseContent += chunk.message.content;
            responseTokens = chunk.eval_count || responseTokens;

            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessage.id
                ? { ...msg, content: responseContent, tokens: responseTokens }
                : msg
            ));

            scrollToBottom();
          }
        }
      } else {
        const response = await client.sendChat(selectedModel, ensureChatMessageFormat(formattedMessages));
        responseContent = response.message?.content || '';
        responseTokens = response.eval_count || 0;

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: responseContent, tokens: responseTokens }
            : msg
        ));
      }

      // Save final assistant response to database
      await db.addMessage(
        activeChat,
        responseContent,
        'assistant',
        responseTokens
      );

    } catch (error: any) {
      console.error('Error processing edited message:', error);
      const errorContent = error.message || 'An unexpected error occurred';

      // Add error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        chat_id: activeChat,
        content: `Error: ${errorContent}`,
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };

      setMessages(prev => [...prev.slice(0, messageIndex + 1), errorMessage]);

      // Save error to database
      await db.addMessage(
        activeChat,
        `Error: ${errorContent}`,
        'assistant',
        0
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-white to-sakura-100 dark:from-gray-900 dark:to-sakura-100/10">
      <AssistantSidebar
        activeChat={activeChat}
        onChatSelect={setActiveChat}
        chats={chats}
        onOpenSettings={() => setShowSettings(true)}
        onNavigateHome={handleNavigateHome}
      />

      <div className="flex-1 flex flex-col">
        <AssistantHeader
          connectionStatus={connectionStatus}
          selectedModel={selectedModel}
          models={models}
          showModelSelect={showModelSelect}
          setShowModelSelect={setShowModelSelect}
          setSelectedModel={handleModelSelect}
          onPageChange={onPageChange}
          onNavigateHome={handleNavigateHome}
          onOpenSettings={() => setShowSettings(true)}
          onOpenKnowledgeBase={() => setShowKnowledgeBase(true)}
          onOpenTools={() => setShowToolModal(true)}
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
          onRetryMessage={handleRetryMessage}
          onEditMessage={handleEditMessage}
          onSendEdit={handleSendEdit}
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
          ragEnabled={ragEnabled}
          onToggleRag={setRagEnabled}
          onTemporaryDocUpload={handleTemporaryDocUpload}
          temporaryDocs={temporaryDocs}
          onRemoveTemporaryDoc={removeTemporaryDoc}
          tools={tools}
          onToolSelect={setSelectedTool}
          models={models}
          onModelConfigSave={handleModelConfigSave}
          modelConfig={modelConfig}
          onModelSelect={handleModelSelect}
        />

        <AssistantSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          isStreaming={isStreaming}
          setIsStreaming={setIsStreaming}
          onOpenTools={() => setShowToolModal(true)}
        />

        <ModelPullModal
          isOpen={showPullModal}
          onClose={() => setShowPullModal(false)}
          onPullModel={handlePullModel}
        />

        <KnowledgeBaseModal
          isOpen={showKnowledgeBase}
          onClose={() => setShowKnowledgeBase(false)}
        />

        <ToolModal
          isOpen={showToolModal}
          onClose={() => setShowToolModal(false)}
          client={client!}
          model={selectedModel}
        />
      </div>
    </div>
  );
};

export default Assistant;