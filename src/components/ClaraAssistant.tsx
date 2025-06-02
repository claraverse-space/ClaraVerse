import React, { useState, useEffect, useCallback } from 'react';
import Topbar from './Topbar';
import ClaraSidebar from './Clara_Components/ClaraSidebar';
import ClaraAssistantInput from './Clara_Components/clara_assistant_input';
import ClaraChatWindow from './Clara_Components/clara_assistant_chat_window';
import { AdvancedOptions } from './Clara_Components/clara_assistant_input';
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
 * Get default system prompt for a provider
 */
const getDefaultSystemPrompt = (provider: ClaraProvider): string => {
  const providerName = provider?.name || 'AI Assistant';
  
  switch (provider?.type) {
    case 'ollama':
      return `You are Clara, a helpful AI assistant powered by ${providerName}. You are knowledgeable, friendly, and provide accurate information. You can help with various tasks including analysis, coding, writing, and general questions. When using tools, be thorough and explain your actions clearly.`;
      
    case 'openai':
      return `You are Clara, an intelligent AI assistant powered by OpenAI. You are helpful, harmless, and honest. You excel at reasoning, analysis, creative tasks, and problem-solving. Always strive to provide accurate, well-structured responses and use available tools effectively when needed.`;
      
    case 'openrouter':
      return `You are Clara, a versatile AI assistant with access to various models through OpenRouter. You adapt your communication style based on the task at hand and leverage the strengths of different AI models. Be helpful, accurate, and efficient in your responses.`;
      
    case 'claras-pocket':
      return `You are Clara, a privacy-focused AI assistant running locally on the user's device. You prioritize user privacy and provide helpful assistance without requiring external connectivity. You are efficient, knowledgeable, and respect the user's privacy preferences.`;
      
    default:
      return `You are Clara, a helpful AI assistant. You are knowledgeable, friendly, and provide accurate information. You can help with various tasks including analysis, coding, writing, and general questions. Always be helpful and respectful in your interactions.`;
  }
};

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
  
  // Advanced options state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
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

  // No models modal state
  const [showNoModelsModal, setShowNoModelsModal] = useState(false);

  // Wallpaper state
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  // Refresh state - track when we last refreshed to avoid too frequent calls
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Refresh providers, models, and MCP services
  const refreshProvidersAndServices = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;
    const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown
    
    // Avoid too frequent refreshes unless forced
    if (!force && timeSinceLastRefresh < REFRESH_COOLDOWN) {
      console.log(`⏳ Skipping refresh - last refresh was ${Math.round(timeSinceLastRefresh / 1000)}s ago (cooldown: ${REFRESH_COOLDOWN / 1000}s)`);
      return;
    }
    
    if (isRefreshing) {
      console.log('🔄 Refresh already in progress, skipping...');
      return;
    }
    
    setIsRefreshing(true);
    setLastRefreshTime(now);
    
    try {
      console.log('🔄 Refreshing providers, models, and services...');
      
      // Refresh MCP service
      try {
        console.log('🔧 Refreshing MCP services...');
        await claraMCPService.refresh();
        console.log('✅ MCP services refreshed');
      } catch (mcpError) {
        console.warn('⚠️ MCP refresh failed:', mcpError);
      }

      // Reload providers
      console.log('🏢 Refreshing providers...');
      const refreshedProviders = await claraApiService.getProviders();
      setProviders(refreshedProviders);
      console.log(`✅ Loaded ${refreshedProviders.length} providers`);

      // Clean up invalid provider configurations
      const validProviderIds = refreshedProviders.map(p => p.id);
      cleanInvalidProviderConfigs(validProviderIds);

      // Load models from ALL providers
      let allModels: ClaraModel[] = [];
      for (const provider of refreshedProviders) {
        try {
          const providerModels = await claraApiService.getModels(provider.id);
          allModels = [...allModels, ...providerModels];
          console.log(`📦 Loaded ${providerModels.length} models from ${provider.name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to load models from ${provider.name}:`, error);
        }
      }
      
      setModels(allModels);
      console.log(`✅ Total models refreshed: ${allModels.length}`);

      // Update current provider if needed
      const currentProviderId = sessionConfig.aiConfig?.provider;
      if (currentProviderId) {
        const currentProvider = refreshedProviders.find(p => p.id === currentProviderId);
        if (currentProvider) {
          claraApiService.updateProvider(currentProvider);
          console.log(`🔧 Updated current provider: ${currentProvider.name}`);
        }
      }

      // Health check current provider
      if (sessionConfig.aiConfig?.provider) {
        const currentProvider = refreshedProviders.find(p => p.id === sessionConfig.aiConfig.provider);
        if (currentProvider) {
          try {
            const isHealthy = await claraApiService.testProvider(currentProvider);
            if (!isHealthy) {
              console.warn(`⚠️ Current provider ${currentProvider.name} health check failed`);
            }
          } catch (healthError) {
            console.warn(`⚠️ Health check failed for ${currentProvider.name}:`, healthError);
          }
        }
      }

      console.log('✅ Providers and services refresh complete');
      
    } catch (error) {
      console.error('❌ Failed to refresh providers and services:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [lastRefreshTime, isRefreshing, sessionConfig.aiConfig?.provider]);

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

  // Auto-refresh when Clara becomes visible again
  useEffect(() => {
    if (isVisible && !isLoadingProviders) {
      // Trigger refresh when Clara becomes visible
      console.log('👁️ Clara became visible - checking for updates...');
      refreshProvidersAndServices(false); // Use cooldown to avoid spam
    }
  }, [isVisible, isLoadingProviders, refreshProvidersAndServices]);

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

        // Load models from ALL providers to check availability
        let allModels: ClaraModel[] = [];
        for (const provider of loadedProviders) {
          try {
            const providerModels = await claraApiService.getModels(provider.id);
            allModels = [...allModels, ...providerModels];
            console.log(`Loaded ${providerModels.length} models from provider: ${provider.name}`);
          } catch (error) {
            console.warn(`Failed to load models from provider ${provider.name}:`, error);
          }
        }
        
        // Set all models for the modal check
        setModels(allModels);
        console.log(`Total models available across all providers: ${allModels.length}`);

        // Get primary provider and set it in config
        const primaryProvider = loadedProviders.find(p => p.isPrimary) || loadedProviders[0];
        if (primaryProvider) {
          // Update API service to use primary provider
          claraApiService.updateProvider(primaryProvider);

          // Get models specifically for the primary provider for configuration
          const primaryProviderModels = allModels.filter(m => m.provider === primaryProvider.id);

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
            const textModel = primaryProviderModels.find(m => 
              m.provider === primaryProvider.id && 
              (m.type === 'text' || m.type === 'multimodal')
            );
            const visionModel = primaryProviderModels.find(m => 
              m.provider === primaryProvider.id && 
              m.supportsVision
            );
            const codeModel = primaryProviderModels.find(m => 
              m.provider === primaryProvider.id && 
              m.supportsCode
            );

            const defaultConfig = {
              provider: primaryProvider.id,
              systemPrompt: getDefaultSystemPrompt(primaryProvider),
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

  // Monitor models availability to show/hide no models modal
  useEffect(() => {
    if (!isLoadingProviders) {
      // Check if there are any models available across all providers
      const hasModels = models.length > 0;
      setShowNoModelsModal(!hasModels);
      
      if (!hasModels) {
        console.log('No models available - showing no models modal');
      } else {
        console.log(`Found ${models.length} models - hiding no models modal`);
      }
    }
  }, [models, isLoadingProviders]);

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

  // Helper function to suggest available vision models
  const getSuggestedVisionModels = useCallback(() => {
    if (!sessionConfig.aiConfig?.provider) return [];
    
    const currentProviderModels = models.filter(m => 
      m.provider === sessionConfig.aiConfig.provider && m.supportsVision
    );
    
    return currentProviderModels.slice(0, 3); // Return top 3 vision models
  }, [models, sessionConfig.aiConfig?.provider]);

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

    // **CRITICAL ENFORCEMENT**: Check streaming vs autonomous mode before sending
    // When streaming mode is enabled, ALWAYS disable autonomous agent and tools
    let enforcedConfig = sessionConfig.aiConfig;
    if (sessionConfig.aiConfig.features?.enableStreaming) {
      console.log('🔒 STREAMING MODE ENFORCEMENT: Disabling autonomous agent and tools for streaming-only mode');
      
      // Create enforced config that disables autonomous features for streaming
      enforcedConfig = {
        ...sessionConfig.aiConfig,
        features: {
          ...sessionConfig.aiConfig.features,
          enableStreaming: true,
          enableTools: false,      // Disable tools in streaming mode
          enableMCP: false        // Disable MCP in streaming mode
        },
        autonomousAgent: {
          enabled: false,          // Disable autonomous agent in streaming mode
          maxRetries: sessionConfig.aiConfig.autonomousAgent?.maxRetries || 3,
          retryDelay: sessionConfig.aiConfig.autonomousAgent?.retryDelay || 1000,
          enableSelfCorrection: sessionConfig.aiConfig.autonomousAgent?.enableSelfCorrection || true,
          enableToolGuidance: sessionConfig.aiConfig.autonomousAgent?.enableToolGuidance || true,
          enableProgressTracking: sessionConfig.aiConfig.autonomousAgent?.enableProgressTracking || true,
          maxToolCalls: sessionConfig.aiConfig.autonomousAgent?.maxToolCalls || 10,
          confidenceThreshold: sessionConfig.aiConfig.autonomousAgent?.confidenceThreshold || 0.7,
          enableChainOfThought: sessionConfig.aiConfig.autonomousAgent?.enableChainOfThought || true,
          enableErrorLearning: sessionConfig.aiConfig.autonomousAgent?.enableErrorLearning || true
        }
      };

      // Update the session config to reflect this enforcement
      setSessionConfig(prev => ({
        ...prev,
        aiConfig: enforcedConfig
      }));

      // Save the enforced config to prevent future conflicts
      if (enforcedConfig.provider) {
        saveProviderConfig(enforcedConfig.provider, enforcedConfig);
      }

      console.log('✅ Streaming mode enforcement applied - autonomous features disabled');
      
      // Notify user about streaming mode enforcement
      addInfoNotification(
        'Streaming Mode Active',
        'Autonomous features automatically disabled for smooth streaming experience.',
        3000
      );
    } else {
      console.log('🛠️ Tools mode active - autonomous features available as configured');
    }

    // Check if this is a voice message with the prefix
    const voiceModePrefix = "Warning: You are in speech mode, make sure to reply in few lines:  \n";
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
        model: `${enforcedConfig.provider}:${enforcedConfig.models.text}`,
        temperature: enforcedConfig.parameters.temperature
      }
    };

    // Add the streaming message to state
    setMessages(prev => [...prev, streamingMessage]);

    try {
      // Get conversation context (configurable context window, default 50 messages)
      const contextWindow = enforcedConfig?.contextWindow || 50;
      const conversationHistory = currentMessages
        .slice(-contextWindow)  // Take last N messages based on config
        .filter(msg => msg.role !== 'system'); // Exclude system messages

      // Get system prompt (provider-specific or fallback to default)
      const currentProvider = providers.find(p => p.id === enforcedConfig.provider);
      const systemPrompt = enforcedConfig.systemPrompt || 
                          (currentProvider ? getDefaultSystemPrompt(currentProvider) : 'You are Clara, a helpful AI assistant.');
      
      // Send message with streaming callback and conversation context
      // Use aiContent (with voice prefix) for AI processing
      // IMPORTANT: Use enforcedConfig to ensure streaming mode settings are applied
      const aiMessage = await claraApiService.sendChatMessage(
        aiContent, // Send full content including voice prefix to AI
        enforcedConfig, // Use enforced config instead of original sessionConfig.aiConfig
        attachments,
        systemPrompt,
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
        // Check for specific vision model error
        const isVisionError = error instanceof Error && (
          error.message.includes('image input is not supported') ||
          error.message.includes('vision not supported') ||
          error.message.includes('multimodal not supported') ||
          error.message.includes('images are not supported')
        );
        
        // Check if user sent images but has vision error
        const hasImages = attachments && attachments.some(att => att.type === 'image');
        
        if (isVisionError || (hasImages && error instanceof Error && error.message.includes('server'))) {
          console.log('Vision model error detected - providing helpful guidance');
          
          // Get suggested vision models for better error message
          const suggestedModels = getSuggestedVisionModels();
          const modelSuggestions = suggestedModels.length > 0 
            ? `\n\n**Available vision models for ${sessionConfig.aiConfig?.provider}:**\n${suggestedModels.map(m => `• ${m.name}`).join('\n')}`
            : '\n\n**Note:** No vision models found for the current provider. You may need to download vision models first.';
          
          const errorMessage: ClaraMessage = {
            id: streamingMessageId,
            role: 'assistant',
            content: `I see you've shared an image, but the current model doesn't support image processing.${modelSuggestions}

**To fix this:**
1. Open **Advanced Options** (click the ⚙️ gear icon)
2. Select a **Vision Model** from the dropdown${suggestedModels.length > 0 ? ` (try ${suggestedModels[0].name})` : ''}
3. Or download vision models from **Settings → Model Manager**

**Alternative:** Switch to **Tools Mode** which can automatically select appropriate models for different tasks.

Would you like me to help with text-only responses for now?`,
            timestamp: new Date(),
            metadata: {
              error: error instanceof Error ? error.message : 'Vision model not configured',
              isStreaming: false,
              isVisionError: true,
              suggestedModels: suggestedModels.map(m => m.id)
            }
          };
          
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId ? errorMessage : msg
          ));

          // Add specific error notification for vision issues
          addErrorNotification(
            'Vision Model Required',
            'Please configure a vision/multimodal model to process images.',
            8000
          );
        } else {
          // Only show generic error message for actual errors (not user aborts)
          const errorMessage: ClaraMessage = {
            id: streamingMessageId,
            role: 'assistant',
            content: 'I apologize, but I encountered an error while processing your request.  Please try again. \n Model Response was : \t'+(error instanceof Error ? error.message : 'Unknown error occurred'),
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
        }

        // Save error message to database
        try {
          // Get the current error message from state to save
          setMessages(prev => {
            const currentMessage = prev.find(msg => msg.id === streamingMessageId);
            if (currentMessage && currentSession) {
              claraDB.addClaraMessage(currentSession.id, currentMessage).catch(dbError => {
                console.error('Failed to save error message:', dbError);
              });
            }
            return prev; // Don't modify state, just access it
          });
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
      
      // POCKET PROVIDER AUTO-START LOGIC
      if (provider.type === 'claras-pocket' && window.llamaSwap) {
        try {
          // Check if running
          const status = await window.llamaSwap.getStatus?.();
          if (!status?.isRunning) {
            addInfoNotification(
              "Starting Clara's Pocket LLM Service...",
              'Attempting to start the native LLM service for you.',
              4000
            );
            const result = await window.llamaSwap.start();
            if (!result.success) {
              addErrorNotification(
                "Failed to Start Clara's Pocket",
                result.error || 'Could not start the native LLM service. Please check your installation.',
                8000
              );
              setIsLoadingProviders(false);
              return;
            }
            // Wait a moment for service to be ready
            await new Promise(res => setTimeout(res, 1500));
          }
        } catch (err) {
          addErrorNotification(
            "Error Starting Clara's Pocket",
            err instanceof Error ? err.message : String(err),
            8000
          );
          setIsLoadingProviders(false);
          return;
        }
      }
      // STEP 1: Health check the provider before proceeding
      console.log('🏥 Testing provider health...');
      addInfoNotification(
        'Testing Provider',
        `Checking connection to ${provider.name}...`,
        2000
      );

      const isHealthy = await claraApiService.testProvider(provider);
      if (!isHealthy) {
        console.error('❌ Provider health check failed for:', provider.name);
        
        // Show error notification with suggestion
        addErrorNotification(
          'Provider Connection Failed',
          `${provider.name} is not responding. Please check if the service is running or try a different provider.`,
          8000
        );
        
        // Don't proceed with provider switch if health check fails
        setIsLoadingProviders(false);
        return;
      }
      
      console.log('✅ Provider health check passed for:', provider.name);
      addInfoNotification(
        'Provider Connected',
        `Successfully connected to ${provider.name}`,
        2000
      );
      
      // STEP 2: Update API service to use selected provider
      claraApiService.updateProvider(provider);
      
      // STEP 3: Load models ONLY from the selected provider
      const newModels = await claraApiService.getModels(providerId);
      console.log('Available models for', provider.name, ':', newModels.map(m => ({ id: m.id, name: m.name })));
      setModels(newModels);
      
      // STEP 4: Create models filtered by current provider for validation
      const providerModels = newModels.filter(m => m.provider === providerId);
      console.log('Filtered models for provider validation:', providerModels.map(m => m.id));
      
      // STEP 5: Try to load saved config for this provider
      const savedConfig = loadProviderConfig(providerId);
      
      if (savedConfig) {
        console.log('Found saved config for', provider.name);
        console.log('Saved models:', savedConfig.models);
        
        // STEP 6: Validate saved models against current provider's available models
        const validTextModel = providerModels.find(m => m.id === savedConfig.models.text);
        const validVisionModel = providerModels.find(m => m.id === savedConfig.models.vision);
        const validCodeModel = providerModels.find(m => m.id === savedConfig.models.code);
        
        console.log('Model validation:');
        console.log('- Text model valid:', !!validTextModel, validTextModel?.id);
        console.log('- Vision model valid:', !!validVisionModel, validVisionModel?.id);
        console.log('- Code model valid:', !!validCodeModel, validCodeModel?.id);
        
        // STEP 7: Create clean config with validated models
        const cleanConfig = {
          provider: providerId,
          systemPrompt: savedConfig.systemPrompt, // Preserve saved system prompt
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
          },
          mcp: savedConfig.mcp || {
            enableTools: true,
            enableResources: true,
            enabledServers: [],
            autoDiscoverTools: true,
            maxToolCalls: 5
          },
          autonomousAgent: savedConfig.autonomousAgent || {
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
          },
          contextWindow: savedConfig.contextWindow || 50
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
        
        // STEP 8: Create fresh default config for this provider
        const textModel = providerModels.find(m => m.type === 'text' || m.type === 'multimodal');
        const visionModel = providerModels.find(m => m.supportsVision);
        const codeModel = providerModels.find(m => m.supportsCode);
        
        console.log('Auto-selected models:');
        console.log('- Text:', textModel?.id || 'none');
        console.log('- Vision:', visionModel?.id || 'none');
        console.log('- Code:', codeModel?.id || 'none');
        
        const defaultConfig = {
          provider: providerId,
          systemPrompt: getDefaultSystemPrompt(provider),
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

  // Handle model preloading when user starts typing
  const handlePreloadModel = useCallback(async () => {
    if (sessionConfig.aiConfig) {
      console.log('🚀 Advanced TTFT preload triggered...');
      
      // Strategy 1: Immediate health check with timeout
      try {
        const healthCheckPromise = claraApiService.healthCheck();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 2000)
        );
        
        const isHealthy = await Promise.race([healthCheckPromise, timeoutPromise]) as boolean;
        if (!isHealthy) {
          console.warn('⚠️ Fast health check failed during preload');
          return;
        }
        
        // Strategy 2: Enhanced preloading with multiple techniques
        await claraApiService.preloadModel(sessionConfig.aiConfig, messages);
        
        // Strategy 3: Prime GPU/CPU for local models
        if (sessionConfig.aiConfig.provider === 'claras-pocket' || 
            sessionConfig.aiConfig.provider === 'ollama') {
          console.log('🔥 Triggering local model warmup...');
          await primeLocalModel(sessionConfig.aiConfig);
        }
        
      } catch (error) {
        console.warn('⚠️ Advanced preload failed:', error);
      }
    }
  }, [sessionConfig.aiConfig, messages]);

  // Prime local models for better TTFT
  const primeLocalModel = useCallback(async (config: ClaraAIConfig) => {
    try {
      // For Clara's Pocket (llama-swap), trigger model preparation
      if (config.provider === 'claras-pocket' && window.llamaSwap) {
        const status = await window.llamaSwap.getStatus();
        if (status?.isRunning) {
          console.log('🎯 Priming Clara Pocket for faster response...');
          // The existing llamaSwapService with TTFT optimizations will handle this
        }
      }
    } catch (error) {
      console.warn('Local model priming failed:', error);
    }
  }, []);

  // Enhanced typing detection with multiple trigger points
  const handleAdvancedTypingDetection = useCallback(() => {
    // Trigger preload on various user interaction events for maximum speed
    console.log('⚡ Early typing detection - triggering aggressive preload');
    handlePreloadModel();
  }, [handlePreloadModel]);

  // Auto-preload when user focuses on input
  useEffect(() => {
    const inputElement = document.querySelector('[data-chat-input]');
    if (inputElement) {
      inputElement.addEventListener('focus', handleAdvancedTypingDetection);
      inputElement.addEventListener('input', handleAdvancedTypingDetection, { once: true });
      
      return () => {
        inputElement.removeEventListener('focus', handleAdvancedTypingDetection);
        inputElement.removeEventListener('input', handleAdvancedTypingDetection);
      };
    }
  }, [handleAdvancedTypingDetection]);

  // Predictive preloading when Clara becomes visible
  useEffect(() => {
    if (isVisible && !isLoadingProviders && sessionConfig.aiConfig) {
      // Small delay then preload for when user is likely to type
      const timer = setTimeout(() => {
        console.log('👁️ Clara visible - predictive preload starting...');
        handlePreloadModel();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, isLoadingProviders, sessionConfig.aiConfig, handlePreloadModel]);

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

    // Add refresh functionality to debug utilities
    (window as any).refreshClaraServices = async (force = false) => {
      console.log('🔄 Manually refreshing Clara services...');
      await refreshProvidersAndServices(force);
    };

    (window as any).debugRefreshStatus = () => {
      console.log('🔄 Refresh Status:');
      console.log('- Is refreshing:', isRefreshing);
      console.log('- Last refresh time:', new Date(lastRefreshTime));
      console.log('- Time since last refresh:', Math.round((Date.now() - lastRefreshTime) / 1000), 'seconds');
      console.log('- Current visibility:', isVisible);
      console.log('- Total models:', models.length);
      console.log('- Total providers:', providers.length);
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

    // Add test for auto-enable autonomous mode functionality
    (window as any).testAutoEnableAutonomous = () => {
      console.log('🧪 Testing Auto-Enable Autonomous Mode Feature...');
      console.log('Current config:', {
        streaming: sessionConfig.aiConfig?.features?.enableStreaming,
        tools: sessionConfig.aiConfig?.features?.enableTools,
        autonomous: sessionConfig.aiConfig?.autonomousAgent?.enabled,
        provider: sessionConfig.aiConfig?.provider
      });
      
      console.log('\n📝 Expected behavior:');
      console.log('1. When Tools Mode is enabled → Autonomous Mode automatically enabled');
      console.log('2. When Streaming Mode is enabled → Autonomous Mode automatically disabled');
      console.log('3. Mode toggle button switches both streaming/tools AND autonomous');
      
      console.log('\n🔧 Test Steps:');
      console.log('1. Open Advanced Options panel');
      console.log('2. Toggle "Enable Tools" checkbox');
      console.log('3. Watch console for "🛠️ Tools enabled" message');
      console.log('4. Verify Autonomous Agent is automatically enabled');
      console.log('5. Toggle mode button between Streaming ↔ Tools');
      console.log('6. Watch console for mode switch messages');
      console.log('7. Verify autonomous mode follows tools mode automatically');
      
      console.log('\n✅ Auto-enable autonomous mode test ready.');
      console.log('💡 Use the UI controls to test the automatic behavior!');
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
      delete (window as any).refreshClaraServices;
      delete (window as any).debugRefreshStatus;
      delete (window as any).debugProblematicTools;
      delete (window as any).testAutoEnableAutonomous;
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
          
          {/* Advanced Options Panel - Above Chat Input */}
          {showAdvancedOptions && (
            <div className="px-6 py-4 transition-all duration-300 ease-out transform animate-in slide-in-from-top-2 fade-in-0">
              <div className="max-w-4xl mx-auto transition-all duration-300">
                <AdvancedOptions
                  aiConfig={sessionConfig.aiConfig}
                  onConfigChange={(newConfig) => {
                    const currentConfig = sessionConfig.aiConfig;
                    const updatedConfig: ClaraAIConfig = {
                      provider: newConfig.provider ?? currentConfig.provider,
                      systemPrompt: newConfig.systemPrompt ?? currentConfig.systemPrompt,
                      models: {
                        text: newConfig.models?.text ?? currentConfig.models.text,
                        vision: newConfig.models?.vision ?? currentConfig.models.vision,
                        code: newConfig.models?.code ?? currentConfig.models.code
                      },
                      parameters: {
                        temperature: newConfig.parameters?.temperature ?? currentConfig.parameters.temperature,
                        maxTokens: newConfig.parameters?.maxTokens ?? currentConfig.parameters.maxTokens,
                        topP: newConfig.parameters?.topP ?? currentConfig.parameters.topP,
                        topK: newConfig.parameters?.topK ?? currentConfig.parameters.topK
                      },
                      features: {
                        enableTools: newConfig.features?.enableTools ?? currentConfig.features.enableTools,
                        enableRAG: newConfig.features?.enableRAG ?? currentConfig.features.enableRAG,
                        enableStreaming: newConfig.features?.enableStreaming ?? currentConfig.features.enableStreaming,
                        enableVision: newConfig.features?.enableVision ?? currentConfig.features.enableVision,
                        autoModelSelection: newConfig.features?.autoModelSelection ?? currentConfig.features.autoModelSelection,
                        enableMCP: newConfig.features?.enableMCP ?? currentConfig.features.enableMCP
                      },
                      mcp: newConfig.mcp ? {
                        enableTools: newConfig.mcp.enableTools ?? currentConfig.mcp?.enableTools ?? true,
                        enableResources: newConfig.mcp.enableResources ?? currentConfig.mcp?.enableResources ?? true,
                        enabledServers: newConfig.mcp.enabledServers ?? currentConfig.mcp?.enabledServers ?? [],
                        autoDiscoverTools: newConfig.mcp.autoDiscoverTools ?? currentConfig.mcp?.autoDiscoverTools ?? true,
                        maxToolCalls: newConfig.mcp.maxToolCalls ?? currentConfig.mcp?.maxToolCalls ?? 5
                      } : currentConfig.mcp,
                      autonomousAgent: newConfig.autonomousAgent ? {
                        enabled: newConfig.autonomousAgent.enabled ?? currentConfig.autonomousAgent?.enabled ?? false,
                        maxRetries: newConfig.autonomousAgent.maxRetries ?? currentConfig.autonomousAgent?.maxRetries ?? 3,
                        retryDelay: newConfig.autonomousAgent.retryDelay ?? currentConfig.autonomousAgent?.retryDelay ?? 1000,
                        enableSelfCorrection: newConfig.autonomousAgent.enableSelfCorrection ?? currentConfig.autonomousAgent?.enableSelfCorrection ?? true,
                        enableToolGuidance: newConfig.autonomousAgent.enableToolGuidance ?? currentConfig.autonomousAgent?.enableToolGuidance ?? true,
                        enableProgressTracking: newConfig.autonomousAgent.enableProgressTracking ?? currentConfig.autonomousAgent?.enableProgressTracking ?? true,
                        maxToolCalls: newConfig.autonomousAgent.maxToolCalls ?? currentConfig.autonomousAgent?.maxToolCalls ?? 10,
                        confidenceThreshold: newConfig.autonomousAgent.confidenceThreshold ?? currentConfig.autonomousAgent?.confidenceThreshold ?? 0.7,
                        enableChainOfThought: newConfig.autonomousAgent.enableChainOfThought ?? currentConfig.autonomousAgent?.enableChainOfThought ?? true,
                        enableErrorLearning: newConfig.autonomousAgent.enableErrorLearning ?? currentConfig.autonomousAgent?.enableErrorLearning ?? true
                      } : currentConfig.autonomousAgent,
                      contextWindow: newConfig.contextWindow ?? currentConfig.contextWindow
                    };
                    handleConfigChange({ aiConfig: updatedConfig });
                  }}
                  providers={providers}
                  models={models}
                  onProviderChange={handleProviderChange}
                  onModelChange={handleModelChange}
                  show={showAdvancedOptions}
                />
              </div>
            </div>
          )}
          
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
            onPreloadModel={handlePreloadModel}
            showAdvancedOptionsPanel={showAdvancedOptions}
            onAdvancedOptionsToggle={setShowAdvancedOptions}
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

      {/* No Models Available Modal */}
      {showNoModelsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 m-4 max-w-md w-full mx-auto transform transition-all duration-300 ease-out scale-100 animate-in fade-in-0 zoom-in-95">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">
              No AI Models Available
            </h2>

            {/* Message */}
            <p className="text-gray-600 dark:text-gray-300 text-center mb-6 leading-relaxed">
              You don't seem to have any AI models downloaded yet. To start chatting with Clara, 
              you'll need to download at least one model from the Model Manager.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => onPageChange('settings')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Go to Model Manager</span>
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                This dialog will disappear once you have downloaded a model
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaraAssistant; 
