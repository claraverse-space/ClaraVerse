import React, { useState, useEffect, useRef } from 'react';
import AssistantSidebar from './AssistantSidebar';
import { AssistantHeader, ChatInput, ChatWindow } from './assistant_components';
import AssistantSettings from './assistant_components/AssistantSettings';
import ImageWarning from './assistant_components/ImageWarning';
import ModelWarning from './assistant_components/ModelWarning';
import ModelPullModal from './assistant_components/ModelPullModal';
import { KnowledgeBaseModal } from './assistant_components';
import { db } from '../db';
import { OllamaClient } from '../utils';
import { generateSystemPromptWithContext } from '../utils/ragUtils';
import type { Message, Chat } from '../db';

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

const MAX_CONTEXT_MESSAGES = 20;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEMP_COLLECTIONS = 5; // Maximum number of temporary collections

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
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [pythonPort, setPythonPort] = useState<number | null>(null);
  const [temporaryDocs, setTemporaryDocs] = useState<TemporaryDocument[]>([]);

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

      // Remove from cache if it exists
      if (doc_ai_cache && doc_ai_cache[collectionName]) {
        delete doc_ai_cache[collectionName];
      }
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
      cleanupAllTempCollections();
    };
  }, []);

  useEffect(() => {
    const getPythonPort = async () => {
      if (window.electron) {
        try {
          const port = await window.electron.getPythonPort();
          setPythonPort(port);
        } catch (error) {
          console.error('Could not get Python port:', error);
        }
      }
    };
    getPythonPort();
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
      cleanupAllTempCollections();
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
      if (!config) {
        setConnectionStatus('disconnected');
        return;
      }

      try {
        let baseUrl: string;
        let clientConfig: any = {};

        if (config.api_type === 'ollama') {
          // Use Ollama's API
          baseUrl = config.ollama_base_url || 'http://localhost:11434';
          clientConfig = { type: 'ollama' };
        } else {
          // OpenAI-like API
          if (config.openai_base_url) {
            // Custom OpenAI-compatible API
            baseUrl = config.openai_base_url.endsWith('/v1')
              ? config.openai_base_url
              : `${config.openai_base_url.replace(/\/$/, '')}/v1`;
          } else {
            // Official OpenAI API
            baseUrl = 'https://api.openai.com/v1';
          }

          clientConfig = {
            type: 'openai',
            apiKey: config.openai_api_key || ''
          };
        }

        const newClient = new OllamaClient(baseUrl, clientConfig);
        setClient(newClient);

        // Test connection
        const modelList = await newClient.listModels();
        setModels(modelList);

        // Rest of the initialization code...
        // ...existing model setup code...

        setConnectionStatus('connected');
      } catch (err) {
        console.error('Failed to connect to API:', err);
        setConnectionStatus('disconnected');
      }
    };

    initializeOllama();
  }, []);

  const handleNewChat = async (initialMessage?: string) => {
    // Create chat with a temporary name - it will be updated after first message
    const chatId = await db.createChat(initialMessage?.slice(0, 50) || 'New Chat');
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

    if (initialMessage) {
      setInput(initialMessage);
      setTimeout(() => handleSend(), 100);
    }
  };

  const getContextMessages = (messages: Message[]): Message[] => {
    // Get the last MAX_CONTEXT_MESSAGES messages
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

  const searchDocuments = async (query: string) => {
    if (!pythonPort) return null;

    try {
      // Get results from temporary collections first
      const tempResults = await Promise.all(
        temporaryDocs.map(doc =>
          fetch(`http://0.0.0.0:${pythonPort}/documents/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              collection_name: doc.collection,
              k: 8,  // Increased from 2 to 8
            }),
          }).then(res => res.json())
        )
      );

      // Only search default collection if no temp docs or RAG is explicitly enabled
      let defaultResults = { results: [] };
      if (ragEnabled || temporaryDocs.length === 0) {
        defaultResults = await fetch(`http://0.0.0.0:${pythonPort}/documents/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            collection_name: 'default_collection',
            k: 8,  // Increased from 2 to 8
          }),
        }).then(res => res.json());
      }

      // Combine results and filter out those with score of 0
      const allResults = [
        ...tempResults.flatMap(r => r.results || []),
        ...(defaultResults?.results || [])
      ]
      .filter(result => result.score > 0) // Filter out results with score of 0
      .sort((a, b) => (b.score || 0) - (a.score || 0));

      return {
        results: allResults.slice(0, 8) // Keep top 8 results instead of 4
      };
    } catch (error) {
      console.error('Error searching documents:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !client || !selectedModel || isProcessing) return;

    // Show warning but don't block if using images with unconfirmed model
    if (images.length > 0 && !checkModelImageSupport(selectedModel)) {
      setShowModelWarning(true);
    }

    let currentChatId = activeChat;
    if (!currentChatId) {
      // Use the first message as the chat name
      const chatName = input.length > 50 ? input.slice(0, 50) + '...' : input;
      currentChatId = await db.createChat(chatName);
      setActiveChat(currentChatId);
    } else {
      // Update the chat title with first user message if it's still "New Chat"
      const currentChats = await db.getRecentChats();
      const thisChat = currentChats.find(c => c.id === currentChatId);
      if (thisChat && thisChat.title === 'New Chat') {
        const newTitle = input.length > 50 ? input.slice(0, 50) + '...' : input;
        await db.updateChat(currentChatId, { title: newTitle });
        const updatedChats = await db.getRecentChats();
        setChats(updatedChats);
      }
    }

    let userContent = input;
    let systemPrompt = await db.getSystemPrompt();

    // If using temporary docs or regular RAG, search and prepend context to user's query
    if (temporaryDocs.length > 0 || ragEnabled) {
      const searchResults = await searchDocuments(input);
      if (searchResults?.results?.length > 0) {
        const context = searchResults.results.map(result => {
          const source = result.metadata.source_file 
            ? `\nSource: ${result.metadata.source_file}` 
            : '';
          const page = result.metadata.page 
            ? ` (Page ${result.metadata.page})` 
            : '';
          return `Content${source}${page}:\n${result.content}`;
        }).join('\n---\n');

        // Prepend context to user's query
        userContent = `I have the following context:\n\n${context}\n\nNote: Only Answer My Question, Do Not Answer Anything Else. My question is: ${input}`;

        // Clean up temporary collections if using them
        if (temporaryDocs.length > 0) {
          await cleanupAllTempCollections();
          setTemporaryDocs([]); // Clear the temporary docs state
        }
      }
    }

    // Create user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      chat_id: currentChatId,
      content: input, // Store original input in message history
      role: 'user',
      timestamp: new Date().toISOString(),
      tokens: 0,
      images: images.length > 0 ? images.map(img => img.preview) : undefined
    };

    // Save user message first
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

    // Create initial placeholder message outside try block
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      chat_id: currentChatId,
      content: '',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      tokens: 0
    };

    try {
      setIsProcessing(true);
      const startTime = performance.now();

      // Add placeholder immediately
      setMessages(prev => [...prev, assistantMessage]);

      // Get context messages and add system prompt
      const contextMessages = getContextMessages([...messages, userMessage]);
      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...contextMessages.slice(0, -1), // All messages except the last one
        { role: 'user', content: userContent } // Use enhanced content for the actual query
      ];

      if (images.length > 0) {
        // Handle image generation
        try {
          const response = await client.generateWithImages(
            selectedModel,
            input,
            images.map(img => img.base64),
            { max_tokens: 1000 }
          );

          const content = response.response || '';
          const tokens = response.eval_count || 0;

          // Update message with response
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content, tokens }
              : msg
          ));

          // Save to database
          await db.addMessage(currentChatId, content, 'assistant', tokens);
        } catch (error: any) {
          // Parse error message if it's JSON
          let errorContent = error.message;
          try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.apiError?.message) {
              errorContent = `API Error: ${parsedError.apiError.message}\n\nFull Response:\n${JSON.stringify(parsedError, null, 2)}`;
            } else if (parsedError.error?.message) {
              errorContent = `Error: ${parsedError.error.message}\n\nFull Response:\n${JSON.stringify(parsedError, null, 2)}`;
            }
          } catch (e) {
            // If not JSON, use the error message as is
            errorContent = `Error: ${error.message}`;
          }

          // Update message with error
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: `\`\`\`json\n${errorContent}\n\`\`\`` }
              : msg
          ));

          // Save error message to database
          await db.addMessage(
            currentChatId,
            `\`\`\`json\n${errorContent}\n\`\`\``,
            'assistant',
            0
          );

          // Re-throw to be caught by outer catch
          throw error;
        }
      } else if (isStreaming) {
        let streamedContent = '';
        let tokens = 0;

        // Stream the response
        try {
          for await (const chunk of client.streamChat(selectedModel, formattedMessages)) {
            if (chunk.message?.content) {
              streamedContent += chunk.message.content;
              tokens = chunk.eval_count || tokens;

              // Update message content as it streams
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: streamedContent, tokens }
                  : msg
              ));

              // Scroll during streaming
              scrollToBottom();
            }
          }

          // Save final message to database
          await db.addMessage(currentChatId, streamedContent, 'assistant', tokens);
        } catch (error: any) {
          console.error('Streaming error:', error);
          throw error; // Let the outer catch handle it
        }
      } else {
        // Non-streaming response
        const response = await client.sendChat(selectedModel, formattedMessages);
        const content = response.message?.content || '';
        const tokens = response.eval_count || 0;

        // Update message with response
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content, tokens }
            : msg
        ));

        // Save to database
        await db.addMessage(currentChatId, content, 'assistant', tokens);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Update model usage statistics
      await db.updateModelUsage(selectedModel, duration);
      await db.updateUsage('response_time', duration);

      // No need to save user message again as it's already saved
      scrollToBottom();

    } catch (error: any) {
      console.error('Error generating response:', error);

      let errorContent;
      try {
        // Try to parse error as JSON
        const parsedError = JSON.parse(error.message);
        errorContent = `Error Response:\n\`\`\`json\n${JSON.stringify(parsedError, null, 2)}\n\`\`\``;
      } catch (e) {
        // If not JSON, use plain text
        errorContent = `Error: ${error.message}`;
      }

      // Update the placeholder message with error
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id
          ? { ...msg, content: errorContent }
          : msg
      ));

      // Save error message to database
      await db.addMessage(
        currentChatId,
        errorContent,
        'assistant',
        0
      );
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
        timestamp: new Date().toISOString(),
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
        for await (const chunk of client.streamChat(selectedModel, formattedMessages)) {
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
        const response = await client.sendChat(selectedModel, formattedMessages);
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
          timestamp: new Date().toISOString()
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
          timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString(),
        tokens: 0
      };

      // Add placeholder message
      setMessages(prev => [...prev.slice(0, messageIndex + 1), assistantMessage]);

      let responseContent = '';
      let responseTokens = 0;

      if (isStreaming) {
        // Handle streaming response
        for await (const chunk of client.streamChat(selectedModel, formattedMessages)) {
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
        const response = await client.sendChat(selectedModel, formattedMessages);
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
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString(),
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
        for await (const chunk of client.streamChat(selectedModel, formattedMessages)) {
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
        const response = await client.sendChat(selectedModel, formattedMessages);
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
        timestamp: new Date().toISOString(),
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

        <KnowledgeBaseModal
          isOpen={showKnowledgeBase}
          onClose={() => setShowKnowledgeBase(false)}
        />
      </div>
    </div>
  );
};

export default Assistant;