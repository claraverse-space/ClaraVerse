import React, { useState, useEffect, useCallback } from 'react';
import Topbar from './Topbar';
import ClaraSidebar from './Clara_Components/ClaraSidebar';
import ClaraAssistantInput from './Clara_Components/clara_assistant_input';
import ClaraChatWindow from './Clara_Components/clara_assistant_chat_window';
import Sidebar from './Sidebar';
import { db } from '../db';
import { claraDB } from '../db/claraDatabase';

// Import Clara types and API service
import { 
  ClaraMessage, 
  ClaraFileAttachment, 
  ClaraSessionConfig, 
  ClaraChatSession,
  ClaraArtifact,
  ClaraProvider,
  ClaraModel,
  ClaraAIConfig
} from '../types/clara_assistant_types';
import { claraApiService } from '../services/claraApiService';
import { saveProviderConfig, loadProviderConfig, cleanInvalidProviderConfigs, validateProviderConfig } from '../utils/providerConfigStorage';
import { debugProviderConfigs, clearAllProviderConfigs } from '../utils/providerConfigStorage';
import { claraMCPService } from '../services/claraMCPService';
import { addCompletionNotification, addBackgroundCompletionNotification, addErrorNotification, addInfoNotification, notificationService } from '../services/notificationService';
import { claraBackgroundService } from '../services/claraBackgroundService';

// Import clear data utility
import '../utils/clearClaraData';
import { copyToClipboard } from '../utils/clipboard';

// Import TTS service
import { claraTTSService } from '../services/claraTTSService';

// Import clipboard test functions for development
if (process.env.NODE_ENV === 'development') {
  import('../utils/clipboard.test');
}

interface ClaraAssistantProps {
  onPageChange: (page: string) => void;
}

/**
 * Generate a unique ID for messages
 */
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Create sample artifacts for demonstration
 */
const createSampleArtifacts = (content: string): ClaraArtifact[] => {
  const artifacts: ClaraArtifact[] = [];

  // Check if the content suggests code
  if (content.toLowerCase().includes('code') || content.toLowerCase().includes('function')) {
    artifacts.push({
      id: generateId(),
      type: 'code',
      title: 'Generated Code Example',
      content: `function greetUser(name) {
  console.log(\`Hello, \${name}! Welcome to Clara!\`);
  return \`Welcome, \${name}\`;
}

// Usage example
const userName = "User";
const greeting = greetUser(userName);
console.log(greeting);`,
      language: 'javascript',
      createdAt: new Date(),
      isExecutable: true
    });
  }

  // Check if the content suggests data/table
  if (content.toLowerCase().includes('table') || content.toLowerCase().includes('data')) {
    artifacts.push({
      id: generateId(),
      type: 'table',
      title: 'Sample Data Table',
      content: JSON.stringify([
        { id: 1, name: 'Clara Assistant', type: 'AI Assistant', status: 'Active' },
        { id: 2, name: 'Document Analysis', type: 'Feature', status: 'Available' },
        { id: 3, name: 'Image Recognition', type: 'Feature', status: 'Available' },
        { id: 4, name: 'Code Generation', type: 'Feature', status: 'Active' }
      ], null, 2),
      createdAt: new Date()
    });
  }

  return artifacts;
};

// Add a hook to detect if Clara is currently visible
const useIsVisible = () => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const checkVisibility = () => {
      // Check if the Clara container is visible
      const claraContainer = document.querySelector('[data-clara-container]');
      if (claraContainer) {
        const isCurrentlyVisible = !claraContainer.classList.contains('hidden');
        setIsVisible(isCurrentlyVisible);
      }
    };
    
    // Check initially
    checkVisibility();
    
    // Set up observer for visibility changes
    const observer = new MutationObserver(checkVisibility);
    const claraContainer = document.querySelector('[data-clara-container]');
    if (claraContainer) {
      observer.observe(claraContainer, { 
        attributes: true, 
        attributeFilter: ['class'] 
      });
    }
    
    return () => observer.disconnect();
  }, []);
  
  return isVisible;
};

const ClaraAssistant: React.FC<ClaraAssistantProps> = ({ onPageChange }) => {
  // Check if Clara is currently visible (for background operation)
  const isVisible = useIsVisible();
  
  // User and session state
  const [userName, setUserName] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<ClaraChatSession | null>(null);
  const [messages, setMessages] = useState<ClaraMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Auto TTS state - track latest AI response for voice synthesis
  const [latestAIResponse, setLatestAIResponse] = useState<string>('');
  const [autoTTSTrigger, setAutoTTSTrigger] = useState<{text: string, timestamp: number} | null>(null);
  
  // Session management state
  const [sessions, setSessions] = useState<ClaraChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [sessionPage, setSessionPage] = useState(0);
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false);
  
  // Provider and model state
  const [providers, setProviders] = useState<ClaraProvider[]>([]);
  const [models, setModels] = useState<ClaraModel[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);

  // Wallpaper state
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  // Session configuration with new AI config structure
  const [sessionConfig, setSessionConfig] = useState<ClaraSessionConfig>({
    aiConfig: {
      models: {
        text: '',
        vision: '',
        code: ''
      },
      provider: '',
      parameters: {
        temperature: 0.7,
        maxTokens: 8000,
        topP: 1.0,
        topK: 40
      },
      features: {
        enableTools: true,
        enableRAG: false,
        enableStreaming: true,
        enableVision: true,
        autoModelSelection: true,
        enableMCP: true
      },
      mcp: {
        enableTools: true,
        enableResources: true,
        enabledServers: [],
        autoDiscoverTools: true,
        maxToolCalls: 5
      },
      autonomousAgent: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        enableSelfCorrection: true,
        enableToolGuidance: true,
        enableProgressTracking: true,
        maxToolCalls: 10,
        confidenceThreshold: 0.7,
        enableChainOfThought: true,
        enableErrorLearning: true
      }
    },
    contextWindow: 50 // Include last 50 messages in conversation history
  });

  // Load user name from database
  useEffect(() => {
    const loadUserName = async () => {
      const personalInfo = await db.getPersonalInfo();
      if (personalInfo?.name) {
        const formattedName = personalInfo.name.charAt(0).toUpperCase() + personalInfo.name.slice(1).toLowerCase();
        setUserName(formattedName);
      }
    };
    loadUserName();
  }, []);

  // Load wallpaper from database
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

  // Track Clara's visibility state for background service
  useEffect(() => {
    claraBackgroundService.setBackgroundMode(!isVisible);
  }, [isVisible]);

  // Load chat sessions on component mount
  useEffect(() => {
    const loadInitialSessions = async () => {
      setIsLoadingSessions(true);
      try {
        console.log('🚀 Starting lightning-fast session loading...');
        const startTime = performance.now();
        
        // Load sessions WITHOUT messages first for instant UI
        const recentSessions = await claraDB.getRecentClaraSessionsLight(20); // Load only 20 initially
        console.log(`⚡ Loaded ${recentSessions.length} sessions in ${(performance.now() - startTime).toFixed(2)}ms`);
        
        setSessions(recentSessions);
        setSessionPage(1);
        setHasMoreSessions(recentSessions.length === 20);
        
        // If no current session and we have existing sessions, load the most recent one
        if (!currentSession && recentSessions.length > 0) {
          const mostRecent = recentSessions[0];
          // Load messages for the most recent session only
          const sessionWithMessages = await claraDB.getClaraSession(mostRecent.id);
          if (sessionWithMessages) {
            setCurrentSession(sessionWithMessages);
            setMessages(sessionWithMessages.messages);
            console.log('📝 Auto-loaded most recent session:', sessionWithMessages.title, 'with', sessionWithMessages.messages.length, 'messages');
          }
        }
        
        // Background cleanup (non-blocking)
        setTimeout(async () => {
          try {
            const integrity = await claraDB.debugDataIntegrity();
            if (integrity.orphanedMessages > 0 || integrity.orphanedFiles > 0) {
              console.log('🧹 Cleaning up orphaned data in background...');
              await claraDB.cleanupOrphanedData();
            }
          } catch (error) {
            console.warn('Background cleanup failed:', error);
          }
        }, 1000);
        
      } catch (error) {
        console.error('Failed to load chat sessions:', error);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadInitialSessions();
  }, []);

  // Load more sessions function for pagination
  const loadMoreSessions = useCallback(async () => {
    if (isLoadingMoreSessions || !hasMoreSessions) return;
    
    setIsLoadingMoreSessions(true);
    try {
      const moreSessions = await claraDB.getRecentClaraSessionsLight(20, sessionPage * 20);
      if (moreSessions.length > 0) {
        setSessions(prev => [...prev, ...moreSessions]);
        setSessionPage(prev => prev + 1);
        setHasMoreSessions(moreSessions.length === 20);
      } else {
        setHasMoreSessions(false);
      }
    } catch (error) {
      console.error('Failed to load more sessions:', error);
    } finally {
      setIsLoadingMoreSessions(false);
    }
  }, [sessionPage, isLoadingMoreSessions, hasMoreSessions]);

  // Load providers and models
  useEffect(() => {
    const loadProvidersAndModels = async () => {
      setIsLoadingProviders(true);
      try {
        // Initialize MCP service
        try {
          await claraMCPService.initialize();
          console.log('MCP service initialized successfully');
        } catch (mcpError) {
          console.warn('MCP service initialization failed:', mcpError);
        }

        // Load providers
        const loadedProviders = await claraApiService.getProviders();
        setProviders(loadedProviders);

        // Clean up invalid provider configurations
        const validProviderIds = loadedProviders.map(p => p.id);
        cleanInvalidProviderConfigs(validProviderIds);

        // Get primary provider and set it in config
        const primaryProvider = loadedProviders.find(p => p.isPrimary) || loadedProviders[0];
        if (primaryProvider) {
          // Update API service to use primary provider
          claraApiService.updateProvider(primaryProvider);

          // Load models only from the primary provider
          const loadedModels = await claraApiService.getModels(primaryProvider.id);
          setModels(loadedModels);

          // Try to load saved config for this provider first
          const savedConfig = loadProviderConfig(primaryProvider.id);
          if (savedConfig) {
            console.log('Loading saved config for provider:', primaryProvider.name, savedConfig);
            setSessionConfig(prev => ({
              ...prev,
              aiConfig: savedConfig
            }));
          } else {
            console.log('No saved config found for provider:', primaryProvider.name, 'creating default config');
            // Auto-select first available models for this provider
            const textModel = loadedModels.find(m => 
              m.provider === primaryProvider.id && 
              (m.type === 'text' || m.type === 'multimodal')
            );
            const visionModel = loadedModels.find(m => 
              m.provider === primaryProvider.id && 
              m.supportsVision
            );
            const codeModel = loadedModels.find(m => 
              m.provider === primaryProvider.id && 
              m.supportsCode
            );

            const defaultConfig = {
              provider: primaryProvider.id,
              models: {
                text: textModel?.id || '',
                vision: visionModel?.id || '',
                code: codeModel?.id || ''
              },
              parameters: {
                temperature: 0.7,
                maxTokens: 4000,
                topP: 1.0,
                topK: 40
              },
              features: {
                enableTools: true,
                enableRAG: false,
                enableStreaming: true,
                enableVision: true,
                autoModelSelection: true,
                enableMCP: true
              },
              mcp: {
                enableTools: true,
                enableResources: true,
                enabledServers: [],
                autoDiscoverTools: true,
                maxToolCalls: 5
              },
              contextWindow: 50 // Include last 50 messages in conversation history
            };

            setSessionConfig(prev => ({
              ...prev,
              aiConfig: defaultConfig
            }));

            // Save the default config
            saveProviderConfig(primaryProvider.id, defaultConfig);
          }
        }
      } catch (error) {
        console.error('Failed to load providers and models:', error);
      } finally {
        setIsLoadingProviders(false);
      }
    };

    loadProvidersAndModels();
  }, []);

  // Initialize TTS service
  useEffect(() => {
    const initializeTTS = async () => {
      try {
        console.log('🔊 Starting TTS service health monitoring...');
        // Force an initial health check
        const isHealthy = await claraTTSService.forceHealthCheck();
        console.log(`✅ TTS service health check complete: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      } catch (error) {
        console.warn('⚠️ TTS service health check failed:', error);
        // TTS is optional, so we don't throw an error
      }
    };

    initializeTTS();
    
    // Cleanup TTS service on unmount
    return () => {
      claraTTSService.destroy();
    };
  }, []);

  // Create new session
  const createNewSession = useCallback(async (): Promise<ClaraChatSession> => {
    try {
      const session = await claraDB.createClaraSession('New Chat');
      setSessions(prev => [session, ...prev]);
      return session;
    } catch (error) {
      console.error('Failed to create new session:', error);
      // Fallback to in-memory session
      const session: ClaraChatSession = {
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        config: sessionConfig
      };
      return session;
    }
  }, [sessionConfig]);

  // Handle sending a new message
  const handleSendMessage = useCallback(async (content: string, attachments?: ClaraFileAttachment[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    if (!currentSession || !sessionConfig.aiConfig) return;

    // Check if this is a voice message with the prefix
    const voiceModePrefix = "Warning: You are in Voice mode keep it precise so the audio is not lengthy. ";
    const isVoiceMessage = content.startsWith(voiceModePrefix);
    
    // For display purposes, use the content without the voice prefix
    const displayContent = isVoiceMessage ? content.replace(voiceModePrefix, '') : content;
    
    // For AI processing, use the full content (including prefix if it's a voice message)
    const aiContent = content;

    // Create user message with display content (without voice prefix)
    const userMessage: ClaraMessage = {
      id: generateId(),
      role: 'user',
      content: displayContent, // Display without voice prefix
      timestamp: new Date(),
      attachments: attachments,
      metadata: {
        isVoiceMessage: isVoiceMessage // Mark as voice message for potential styling
      }
    };

    // Add user message to state and get current conversation
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    // Track background activity
    if (!isVisible) {
      claraBackgroundService.incrementBackgroundActivity();
    }

    // Save user message to database (with display content only)
    try {
      await claraDB.addClaraMessage(currentSession.id, userMessage);
    } catch (error) {
      console.error('Failed to save user message:', error);
    }

    // Create a temporary streaming message for the assistant
    const streamingMessageId = generateId();
    const streamingMessage: ClaraMessage = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      metadata: {
        isStreaming: true,
        model: `${sessionConfig.aiConfig.provider}:${sessionConfig.aiConfig.models.text}`,
        temperature: sessionConfig.aiConfig.parameters.temperature
      }
    };

    // Add the streaming message to state
    setMessages(prev => [...prev, streamingMessage]);

    try {
      // Get conversation context (configurable context window, default 50 messages)
      const contextWindow = sessionConfig.aiConfig?.contextWindow || 50;
      const conversationHistory = currentMessages
        .slice(-contextWindow)  // Take last N messages based on config
        .filter(msg => msg.role !== 'system'); // Exclude system messages

      // Send message with streaming callback and conversation context
      // Use aiContent (with voice prefix) for AI processing
      const aiMessage = await claraApiService.sendChatMessage(
        aiContent, // Send full content including voice prefix to AI
        sessionConfig.aiConfig,
        attachments,
        sessionConfig.systemPrompt,
        conversationHistory, // Pass conversation context
        // Streaming callback to update content in real-time
        (chunk: string) => {
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ));
        }
      );
      
      // Replace the streaming message with the final message
      const finalMessage = { 
        ...aiMessage, 
        id: streamingMessageId, // Keep the same ID
        metadata: {
          ...aiMessage.metadata,
          isStreaming: false // Mark as complete
        }
      };

      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId ? finalMessage : msg
      ));

      // Update latest AI response for auto TTS
      setLatestAIResponse(finalMessage.content);
      setAutoTTSTrigger({
        text: finalMessage.content,
        timestamp: Date.now()
      });

      // Save AI message to database
      try {
        await claraDB.addClaraMessage(currentSession.id, finalMessage);
        
        // Enhanced notification for background operation
        if (!isVisible) {
          // More prominent notification when Clara is in background
          // Use display content for notifications (without voice prefix)
          addBackgroundCompletionNotification(
            'Clara Response Ready',
            `Clara has finished responding to: "${displayContent.slice(0, 40)}${displayContent.length > 40 ? '...' : ''}"`
          );
          // Track background notification creation
          claraBackgroundService.onBackgroundNotificationCreated();
        } else {
          // Standard notification when Clara is visible
          addCompletionNotification(
            'Chat Response Complete',
            isVoiceMessage ? 'Clara has finished responding to your voice message.' : 'Clara has finished responding to your message.',
            4000
          );
        }
      } catch (error) {
        console.error('Failed to save AI message:', error);
      }

      // Update session title if it's still "New Chat"
      if (currentSession.title === 'New Chat') {
        // Use display content for session title (without voice prefix)
        const newTitle = displayContent.slice(0, 50) + (displayContent.length > 50 ? '...' : '');
        const updatedSession = {
          ...currentSession,
          title: newTitle,
          messages: [...currentMessages, finalMessage],
          updatedAt: new Date()
        };
        
        setCurrentSession(updatedSession);
        
        // Update in database and sessions list
        try {
          await claraDB.updateClaraSession(currentSession.id, { title: newTitle });
          setSessions(prev => prev.map(s => 
            s.id === currentSession.id ? { ...s, title: newTitle } : s
          ));
        } catch (error) {
          console.error('Failed to update session title:', error);
        }
      }

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Check if this is an abort error (user stopped the stream)
      const isAbortError = error instanceof Error && (
        error.message.includes('aborted') ||
        error.message.includes('BodyStreamBuffer was aborted') ||
        error.message.includes('AbortError') ||
        error.name === 'AbortError'
      );
      
      if (isAbortError) {
        console.log('Stream was aborted by user, preserving streamed content');
        
        // Just mark the current streaming message as complete, preserving all streamed content
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { 
                ...msg, 
                metadata: {
                  ...msg.metadata,
                  isStreaming: false,
                  aborted: true
                }
              }
            : msg
        ));

        // Save the aborted message to database with its current content
        try {
          // Get the current message with streamed content from state
          setMessages(prev => {
            const currentMessage = prev.find(msg => msg.id === streamingMessageId);
            if (currentMessage && currentSession) {
              const abortedMessage = {
                ...currentMessage,
                metadata: {
                  ...currentMessage.metadata,
                  isStreaming: false,
                  aborted: true
                }
              };
              // Save to database asynchronously
              claraDB.addClaraMessage(currentSession.id, abortedMessage).catch(dbError => {
                console.error('Failed to save aborted message:', dbError);
              });
            }
            return prev; // Don't actually modify the state here, just access it
          });
        } catch (dbError) {
          console.error('Failed to save aborted message:', dbError);
        }
      } else {
        // Only show error message for actual errors (not user aborts)
        const errorMessage: ClaraMessage = {
          id: streamingMessageId,
          role: 'assistant',
          content: 'I apologize, but I encountered an error while processing your request. Please try again.',
          timestamp: new Date(),
          metadata: {
            error: error instanceof Error ? error.message : 'Failed to generate response',
            isStreaming: false
          }
        };
        
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId ? errorMessage : msg
        ));

        // Add error notification
        addErrorNotification(
          'Chat Error',
          'Failed to generate response. Please try again.',
          6000
        );

        // Save error message to database
        try {
          await claraDB.addClaraMessage(currentSession.id, errorMessage);
        } catch (dbError) {
          console.error('Failed to save error message:', dbError);
        }
      }
    } finally {
      setIsLoading(false);
      // Always decrement background activity when operation completes
      if (!isVisible) {
        claraBackgroundService.decrementBackgroundActivity();
      }
    }
  }, [currentSession, messages, sessionConfig, isVisible]);

  // Handle session selection
  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (currentSession?.id === sessionId) return;
    
    try {
      const session = await claraDB.getClaraSession(sessionId);
      if (session) {
        setCurrentSession(session);
        setMessages(session.messages);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, [currentSession]);

  // Handle new chat creation
  const handleNewChat = useCallback(async () => {
    const newSession = await createNewSession();
    setCurrentSession(newSession);
    setMessages([]);
  }, [createNewSession]);

  // Handle session actions
  const handleSessionAction = useCallback(async (sessionId: string, action: 'star' | 'archive' | 'delete') => {
    try {
      if (action === 'delete') {
        console.log('Deleting session:', sessionId);
        await claraDB.deleteClaraSession(sessionId);
        
        // Update sessions list immediately
        setSessions(prev => {
          const updated = prev.filter(s => s.id !== sessionId);
          console.log('Updated sessions after delete:', updated.map(s => ({ id: s.id, title: s.title })));
          return updated;
        });
        
        // If we deleted the current session, create a new one or select another
        if (currentSession?.id === sessionId) {
          console.log('Deleted current session, selecting new one...');
          const remainingSessions = sessions.filter(s => s.id !== sessionId);
          if (remainingSessions.length > 0) {
            // Select the most recent remaining session
            const nextSession = await claraDB.getClaraSession(remainingSessions[0].id);
            if (nextSession) {
              setCurrentSession(nextSession);
              setMessages(nextSession.messages);
              console.log('Selected next session:', nextSession.title);
            }
          } else {
            // No sessions left, create a new one
            await handleNewChat();
          }
        }
      } else {
        const updates = action === 'star' 
          ? { isStarred: !sessions.find(s => s.id === sessionId)?.isStarred }
          : { isArchived: !sessions.find(s => s.id === sessionId)?.isArchived };
        
        await claraDB.updateClaraSession(sessionId, updates);
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, ...updates } : s
        ));
      }
    } catch (error) {
      console.error(`Failed to ${action} session:`, error);
    }
  }, [sessions, currentSession, handleNewChat]);

  // Handle provider change
  const handleProviderChange = useCallback(async (providerId: string) => {
    try {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) {
        console.error('Provider not found:', providerId);
        return;
      }

      setIsLoadingProviders(true);
      console.log('=== Switching to provider ===');
      console.log('Provider:', provider.name, '(ID:', providerId, ')');
      
      // STEP 1: Update API service to use selected provider
      claraApiService.updateProvider(provider);
      
      // STEP 2: Load models ONLY from the selected provider
      const newModels = await claraApiService.getModels(providerId);
      console.log('Available models for', provider.name, ':', newModels.map(m => ({ id: m.id, name: m.name })));
      setModels(newModels);
      
      // STEP 3: Create models filtered by current provider for validation
      const providerModels = newModels.filter(m => m.provider === providerId);
      console.log('Filtered models for provider validation:', providerModels.map(m => m.id));
      
      // STEP 4: Try to load saved config for this provider
      const savedConfig = loadProviderConfig(providerId);
      
      if (savedConfig) {
        console.log('Found saved config for', provider.name);
        console.log('Saved models:', savedConfig.models);
        
        // STEP 5: Validate saved models against current provider's available models
        const validTextModel = providerModels.find(m => m.id === savedConfig.models.text);
        const validVisionModel = providerModels.find(m => m.id === savedConfig.models.vision);
        const validCodeModel = providerModels.find(m => m.id === savedConfig.models.code);
        
        console.log('Model validation:');
        console.log('- Text model valid:', !!validTextModel, validTextModel?.id);
        console.log('- Vision model valid:', !!validVisionModel, validVisionModel?.id);
        console.log('- Code model valid:', !!validCodeModel, validCodeModel?.id);
        
        // STEP 6: Create clean config with validated models
        const cleanConfig = {
          provider: providerId,
          models: {
            text: validTextModel ? savedConfig.models.text : '',
            vision: validVisionModel ? savedConfig.models.vision : '',
            code: validCodeModel ? savedConfig.models.code : ''
          },
          parameters: {
            ...savedConfig.parameters
          },
          features: {
            ...savedConfig.features
          }
        };
        
        console.log('Applied clean config:', cleanConfig);
        setSessionConfig(prev => ({
          ...prev,
          aiConfig: cleanConfig
        }));
        
        // If any models were invalid, save the cleaned config
        if (!validTextModel || !validVisionModel || !validCodeModel) {
          console.log('Cleaning invalid models from saved config');
          saveProviderConfig(providerId, cleanConfig);
        }
        
      } else {
        console.log('No saved config found for', provider.name, '- creating default');
        
        // STEP 7: Create fresh default config for this provider
        const textModel = providerModels.find(m => m.type === 'text' || m.type === 'multimodal');
        const visionModel = providerModels.find(m => m.supportsVision);
        const codeModel = providerModels.find(m => m.supportsCode);
        
        console.log('Auto-selected models:');
        console.log('- Text:', textModel?.id || 'none');
        console.log('- Vision:', visionModel?.id || 'none');
        console.log('- Code:', codeModel?.id || 'none');
        
        const defaultConfig = {
          provider: providerId,
          models: {
            text: textModel?.id || '',
            vision: visionModel?.id || '',
            code: codeModel?.id || ''
          },
          parameters: {
            temperature: 0.7,
            maxTokens: 4000,
            topP: 1.0,
            topK: 40
          },
          features: {
            enableTools: true,
            enableRAG: false,
            enableStreaming: true,
            enableVision: true,
            autoModelSelection: true,
            enableMCP: true
          },
          mcp: {
            enableTools: true,
            enableResources: true,
            enabledServers: [],
            autoDiscoverTools: true,
            maxToolCalls: 5
          },
          contextWindow: 50 // Include last 50 messages in conversation history
        };
        
        console.log('Created default config:', defaultConfig);
        setSessionConfig(prev => ({
          ...prev,
          aiConfig: defaultConfig
        }));
        
        // Save the default config
        saveProviderConfig(providerId, defaultConfig);
      }
      
      console.log('=== Provider switch complete ===');
      
    } catch (error) {
      console.error('Failed to change provider:', error);
    } finally {
      setIsLoadingProviders(false);
    }
  }, [providers]);

  // Handle model change
  const handleModelChange = useCallback((modelId: string, type: 'text' | 'vision' | 'code') => {
    setSessionConfig(prev => {
      if (!prev.aiConfig?.provider) {
        console.error('No provider set when trying to change model');
        return prev;
      }

      // Validate that the selected model belongs to the current provider
      const selectedModel = models.find(m => m.id === modelId);
      if (selectedModel && selectedModel.provider !== prev.aiConfig.provider) {
        console.error('Model validation failed: Model', modelId, 'belongs to provider', selectedModel.provider, 'but current provider is', prev.aiConfig.provider);
        return prev; // Don't update if model is from wrong provider
      }

      console.log('Model change validation passed:', {
        modelId,
        type,
        provider: prev.aiConfig.provider,
        modelProvider: selectedModel?.provider
      });

      const updatedConfig = {
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          models: {
            ...prev.aiConfig.models,
            [type]: modelId
          }
        }
      };
      
      // Save the updated configuration for the current provider
      if (updatedConfig.aiConfig?.provider) {
        saveProviderConfig(updatedConfig.aiConfig.provider, updatedConfig.aiConfig);
        console.log('Saved model change for provider:', updatedConfig.aiConfig.provider, type, modelId);
      }
      
      return updatedConfig;
    });
  }, [models]);

  // Handle message interactions
  const handleCopyMessage = useCallback(async (content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      // Could show a toast notification here
      console.log('Message copied:', content);
    } else {
      console.error('Failed to copy message');
    }
  }, []);

  const handleRetryMessage = useCallback((messageId: string) => {
    console.log('Retrying message:', messageId);
    // Implementation for retrying failed messages
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex > 0) {
      const previousMessage = messages[messageIndex - 1];
      if (previousMessage.role === 'user') {
        handleSendMessage(previousMessage.content, previousMessage.attachments);
      }
    }
  }, [messages, handleSendMessage]);

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    console.log('Editing message:', messageId, newContent);
    // Implementation for editing messages
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: newContent, timestamp: new Date() }
        : msg
    ));
  }, []);

  // Handle stopping generation
  const handleStop = useCallback(() => {
    console.log('Stopping generation...');
    claraApiService.stop();
    setIsLoading(false);
  }, []);

  // Handle session config changes
  const handleConfigChange = useCallback((newConfig: Partial<ClaraSessionConfig>) => {
    setSessionConfig(prev => {
      const updated = { ...prev, ...newConfig };
      
      // Only save provider-specific configuration if we have a valid provider
      if (updated.aiConfig?.provider) {
        // If provider is changing through this config change, don't save mixed config
        if (newConfig.aiConfig?.provider && newConfig.aiConfig.provider !== prev.aiConfig?.provider) {
          console.log('Provider changing through config, will be handled by provider change handler');
          return updated;
        }
        
        // Validate models belong to current provider before saving
        if (newConfig.aiConfig?.models) {
          const currentProvider = updated.aiConfig.provider;
          const models_ = newConfig.aiConfig.models;
          const textModel = models_.text ? models.find(m => m.id === models_.text) : null;
          const visionModel = models_.vision ? models.find(m => m.id === models_.vision) : null;
          const codeModel = models_.code ? models.find(m => m.id === models_.code) : null;
          
          if ((textModel && textModel.provider !== currentProvider) ||
              (visionModel && visionModel.provider !== currentProvider) ||
              (codeModel && codeModel.provider !== currentProvider)) {
            console.error('Config validation failed: Models from wrong provider in config change');
            return prev; // Don't update if models are from wrong provider
          }
        }
        
        saveProviderConfig(updated.aiConfig.provider, updated.aiConfig);
        console.log('Saved config change for provider:', updated.aiConfig.provider, newConfig);
      }
      
      return updated;
    });
  }, [models]);

  // Debug utility for testing provider configurations
  useEffect(() => {
    // Expose debug functions to window for testing
    (window as any).debugClaraProviders = () => {
      console.log('Current provider configurations:');
      console.log('Providers:', providers.map(p => ({ id: p.id, name: p.name, isPrimary: p.isPrimary })));
      console.log('Models:', models.map(m => ({ id: m.id, name: m.name, provider: m.provider })));
      console.log('Current session config:', sessionConfig);
      console.log('Current session:', currentSession?.id, currentSession?.title);
      
      // Debug provider configs from localStorage
      debugProviderConfigs();
    };

    (window as any).clearProviderConfigs = () => {
      clearAllProviderConfigs();
      console.log('Cleared all provider configurations. Refresh to see changes.');
    };

    // Add MCP debugging functions
    (window as any).debugMCP = async () => {
      console.log('=== MCP Debug Info ===');
      console.log('MCP Service Ready:', claraMCPService.isReady());
      console.log('Available Servers:', claraMCPService.getRunningServers());
      console.log('Available Tools:', claraMCPService.getAvailableTools());
      console.log('Session MCP Config:', sessionConfig.aiConfig?.mcp);
    };

    // Add notification testing functions
    (window as any).testNotifications = () => {
      console.log('🔔 Testing notification system...');
      addCompletionNotification('Test Completion', 'This is a test completion notification with chime!');
      setTimeout(() => {
        addErrorNotification('Test Error', 'This is a test error notification.');
      }, 2000);
      setTimeout(() => {
        addInfoNotification('Test Info', 'This is a test info notification.');
      }, 4000);
    };

    (window as any).testCompletionSound = () => {
      console.log('🔔 Testing completion chime...');
      notificationService.testCompletionChime();
    };

    (window as any).setupTestMCP = async () => {
      console.log('🔧 Setting up test MCP server...');
      const success = await claraMCPService.setupTestGitHubServer();
      if (success) {
        console.log('✅ Test MCP server setup complete');
        await claraMCPService.refresh();
        console.log('📊 Updated MCP status:', {
          servers: claraMCPService.getRunningServers().length,
          tools: claraMCPService.getAvailableTools().length
        });
      } else {
        console.log('❌ Test MCP server setup failed');
      }
    };

    // Add background service debugging functions
    (window as any).debugBackground = () => {
      console.log('🔄 Clara Background Service Status:');
      console.log(claraBackgroundService.getStatus());
      console.log('Current visibility:', isVisible);
    };

    (window as any).testBackgroundChat = async () => {
      console.log('🧪 Testing background chat...');
      if (isVisible) {
        console.log('⚠️ Clara is currently visible. Switch to another page to test background mode.');
        return;
      }
      
      // Simulate a background message
      await handleSendMessage('This is a test message sent while Clara is in background mode.');
    };

    (window as any).testBackgroundNotification = () => {
      console.log('🧪 Testing persistent background notification...');
      addBackgroundCompletionNotification(
        'Clara Response Ready',
        'This is a persistent notification that requires manual dismissal. It will not auto-hide.'
      );
      claraBackgroundService.onBackgroundNotificationCreated();
    };

    (window as any).testBackgroundService = () => {
      console.log('🧪 Testing Clara background service notification...');
      // Simulate Clara going to background mode
      claraBackgroundService.setBackgroundMode(true);
      
      // Simulate some background activity
      setTimeout(() => {
        claraBackgroundService.incrementBackgroundActivity();
        console.log('📊 Added background activity');
      }, 1000);
      
      setTimeout(() => {
        claraBackgroundService.decrementBackgroundActivity();
        console.log('📊 Removed background activity');
      }, 3000);
      
      // Return to foreground after 5 seconds
      setTimeout(() => {
        claraBackgroundService.setBackgroundMode(false);
        console.log('👁️ Returned to foreground');
      }, 5000);
    };

    // Add provider-specific debugging functions
    (window as any).debugProblematicTools = (providerId?: string) => {
      console.log('=== Provider-Specific Problematic Tools Debug ===');
      if (providerId) {
        console.log(`Problematic tools for provider ${providerId}:`);
        const storageKey = `clara-problematic-tools-${providerId}`;
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        console.log('Stored tools:', stored);
      } else {
        console.log('All provider-specific problematic tools:');
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('clara-problematic-tools-')) {
            const stored = JSON.parse(localStorage.getItem(key) || '[]');
            console.log(`${key}:`, stored);
          }
        }
      }
    };

    (window as any).clearProblematicToolsForProvider = (providerId: string) => {
      console.log(`🗑️ Clearing problematic tools for provider: ${providerId}`);
      // Import the classes dynamically to access static methods
      import('../utils/APIClient').then(({ APIClient }) => {
        APIClient.clearProblematicToolsForProvider(providerId);
      });
      import('../utils/OllamaClient').then(({ OllamaClient }) => {
        OllamaClient.clearProblematicToolsForProvider(providerId);
      });
    };

    (window as any).testProviderSpecificToolError = () => {
      console.log('🧪 Testing provider-specific tool error handling...');
      console.log('Current provider:', sessionConfig.aiConfig?.provider);
      console.log('This feature will now store problematic tools per provider instead of globally.');
      console.log('Use debugProblematicTools() to see stored tools per provider.');
    };

    (window as any).testClaraPerformance = () => {
      console.log('🚀 Clara Performance Test Results:');
      console.log('Current loading strategy: Lazy loading with pagination');
      console.log('Sessions loaded:', sessions.length);
      console.log('Has more sessions:', hasMoreSessions);
      console.log('Current session page:', sessionPage);
      console.log('Loading states:', {
        isLoadingSessions,
        isLoadingMoreSessions,
        isLoadingProviders
      });
      
      // Test loading time
      const startTime = performance.now();
      setTimeout(() => {
        const endTime = performance.now();
        console.log(`UI responsiveness test: ${(endTime - startTime).toFixed(2)}ms`);
      }, 0);
    };

    (window as any).testStreamingAutonomousExclusivity = () => {
      console.log('🧪 Testing Streaming/Autonomous Agent Mutual Exclusivity...');
      console.log('Current config:', {
        streaming: sessionConfig.aiConfig?.features?.enableStreaming,
        autonomous: sessionConfig.aiConfig?.autonomousAgent?.enabled,
        tools: sessionConfig.aiConfig?.features?.enableTools,
        mcp: sessionConfig.aiConfig?.features?.enableMCP
      });
      
      // Test 1: Enable streaming should disable autonomous
      console.log('\n📝 Test 1: Enabling streaming should disable autonomous agent');
      const streamingConfig = {
        ...sessionConfig.aiConfig,
        features: {
          ...sessionConfig.aiConfig?.features,
          enableStreaming: true,
          enableTools: false,
          enableMCP: false
        },
        autonomousAgent: {
          enabled: false,
          maxRetries: sessionConfig.aiConfig?.autonomousAgent?.maxRetries || 3,
          retryDelay: sessionConfig.aiConfig?.autonomousAgent?.retryDelay || 1000,
          enableSelfCorrection: sessionConfig.aiConfig?.autonomousAgent?.enableSelfCorrection || true,
          enableToolGuidance: sessionConfig.aiConfig?.autonomousAgent?.enableToolGuidance || true,
          enableProgressTracking: sessionConfig.aiConfig?.autonomousAgent?.enableProgressTracking || true,
          maxToolCalls: sessionConfig.aiConfig?.autonomousAgent?.maxToolCalls || 10,
          confidenceThreshold: sessionConfig.aiConfig?.autonomousAgent?.confidenceThreshold || 0.7,
          enableChainOfThought: sessionConfig.aiConfig?.autonomousAgent?.enableChainOfThought || true,
          enableErrorLearning: sessionConfig.aiConfig?.autonomousAgent?.enableErrorLearning || true
        }
      };
      
      console.log('Expected streaming config:', {
        streaming: streamingConfig.features?.enableStreaming,
        autonomous: streamingConfig.autonomousAgent?.enabled,
        tools: streamingConfig.features?.enableTools,
        mcp: streamingConfig.features?.enableMCP
      });
      
      // Test 2: Enable autonomous should disable streaming
      console.log('\n📝 Test 2: Enabling autonomous agent should disable streaming');
      const autonomousConfig = {
        ...sessionConfig.aiConfig,
        features: {
          ...sessionConfig.aiConfig?.features,
          enableStreaming: false,
          enableTools: true,
          enableMCP: true
        },
        autonomousAgent: {
          ...sessionConfig.aiConfig?.autonomousAgent,
          enabled: true
        }
      };
      
      console.log('Expected autonomous config:', {
        streaming: autonomousConfig.features?.enableStreaming,
        autonomous: autonomousConfig.autonomousAgent?.enabled,
        tools: autonomousConfig.features?.enableTools,
        mcp: autonomousConfig.features?.enableMCP
      });
      
      console.log('\n✅ Mutual exclusivity test complete. Check the UI to verify behavior matches expected configs.');
    };

    return () => {
      delete (window as any).debugClaraProviders;
      delete (window as any).clearProviderConfigs;
      delete (window as any).debugMCP;
      delete (window as any).testNotifications;
      delete (window as any).testCompletionSound;
      delete (window as any).setupTestMCP;
      delete (window as any).debugBackground;
      delete (window as any).testBackgroundChat;
      delete (window as any).testBackgroundNotification;
      delete (window as any).testBackgroundService;
      delete (window as any).debugProblematicTools;
      delete (window as any).clearProblematicToolsForProvider;
      delete (window as any).testProviderSpecificToolError;
      delete (window as any).testClaraPerformance;
      delete (window as any).testStreamingAutonomousExclusivity;
    };
  }, [providers, models, sessionConfig, currentSession, isVisible, handleSendMessage]);

  // Initialize with a new session if none exists
  useEffect(() => {
    const initializeSession = async () => {
      // Only create a new session if we're not loading and there are no sessions and no current session
      if (!isLoadingSessions && sessions.length === 0 && !currentSession) {
        const newSession = await createNewSession();
        setCurrentSession(newSession);
        setMessages([]);
        console.log('Created new session as no sessions exist');
      }
    };
    
    initializeSession();
  }, [isLoadingSessions, sessions.length, currentSession, createNewSession]);

  return (
    <div className="flex h-screen w-full relative" data-clara-container>
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

      {/* Content with relative z-index */}
      <div className="relative z-10 flex h-screen w-full">
        {/* App Sidebar (main navigation) on the left */}
        <Sidebar activePage="clara" onPageChange={onPageChange} />

        {/* Main: Chat Area */}
        <div className="flex-1 flex flex-col h-full">
          {/* Header */}
          <Topbar 
            userName={userName}
            onPageChange={onPageChange}
          />
          
          {/* Chat Window */}
          <ClaraChatWindow
            messages={messages}
            userName={userName}
            isLoading={isLoading}
            isInitializing={isLoadingSessions || isLoadingProviders}
            onRetryMessage={handleRetryMessage}
            onCopyMessage={handleCopyMessage}
            onEditMessage={handleEditMessage}
          />
          
          {/* Chat Input */}
          <ClaraAssistantInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading || isLoadingProviders}
            sessionConfig={sessionConfig}
            onConfigChange={handleConfigChange}
            providers={providers}
            models={models}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onStop={handleStop}
            onNewChat={handleNewChat}
            autoTTSText={latestAIResponse}
            autoTTSTrigger={autoTTSTrigger}
          />
        </div>

        {/* Clara Chat History Sidebar on the right */}
        <ClaraSidebar 
          sessions={sessions}
          currentSessionId={currentSession?.id}
          isLoading={isLoadingSessions}
          isLoadingMore={isLoadingMoreSessions}
          hasMoreSessions={hasMoreSessions}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onSessionAction={handleSessionAction}
          onLoadMore={loadMoreSessions}
        />
      </div>
    </div>
  );
};

export default ClaraAssistant; 
