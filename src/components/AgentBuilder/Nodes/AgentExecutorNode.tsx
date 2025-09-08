import { memo, useState, useEffect, useCallback} from 'react';
import { NodeProps } from 'reactflow';
import { Bot, Settings, Play, CheckCircle, AlertCircle, Server} from 'lucide-react';
import BaseNode from './BaseNode';

// Import Clara services for agent execution
import { claraApiService } from '../../../services/claraApiService';
import { ClaraAgentExecutionService, AgentExecutionConfig } from '../../../services/claraAgentExecutionService';
import { ClaraProvider, ClaraModel } from '../../../types/clara_assistant_types';

// Enhanced interfaces for Phase 2
interface ExecutionStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
  toolsUsed?: string[];
}

interface ExecutionHistory {
  id: string;
  timestamp: number;
  instructions: string;
  config: AgentExecutionConfig;
  status: 'success' | 'failed' | 'partial';
  duration: number;
  steps: ExecutionStep[];
  result?: any;
  error?: string;
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
  config: Partial<AgentExecutionConfig>;
  category: 'data' | 'coding' | 'analysis' | 'content' | 'automation';
}

interface AgentExecutorNodeData {
  // Agent Configuration
  provider: string;
  textModel: string;
  visionModel?: string;
  codeModel?: string;
  enabledMCPServers: string[];
  
  // Custom Provider Support
  useCustomProvider?: boolean;
  customProviderName?: string;
  customProviderUrl?: string;
  customProviderKey?: string;
  customProviderModel?: string;
  
  // Agent Behavior
  instructions: string;
  maxRetries: number;
  timeoutMs: number;
  
  // AI Parameters
  temperature: number;
  maxTokens: number;
  
  // Advanced Settings
  enableSelfCorrection: boolean;
  enableChainOfThought: boolean;
  enableToolGuidance: boolean;
  maxToolCalls: number;
  confidenceThreshold: number;
  
  // Phase 2: Enhanced execution state
  isExecuting?: boolean;
  lastExecutionResult?: any;
  executionLogs?: string[];
  currentSteps?: ExecutionStep[];
  executionHistory?: ExecutionHistory[];
  selectedTemplate?: AgentTemplate;
  enableMultiStep?: boolean;
  enableRealTimeMonitoring?: boolean;
  
  onUpdate?: (updates: any) => void;
}

const AgentExecutorNode = memo<NodeProps<AgentExecutorNodeData>>((props) => {
  const { data } = props;
  
  // State for configuration
  const [provider, setProvider] = useState(data.provider || '');
  const [model, setModel] = useState(data.textModel || data.visionModel || '');
  const [instructions, setInstructions] = useState(data.instructions || '');
  const [enabledMCPServers, setEnabledMCPServers] = useState<string[]>(data.enabledMCPServers || []);
  
  // Custom provider state
  const [useCustomProvider, setUseCustomProvider] = useState(data.useCustomProvider || false);
  const [customProvider, setCustomProvider] = useState({
    name: data.customProviderName || '',
    baseUrl: data.customProviderUrl || '',
    apiKey: data.customProviderKey || '',
    model: data.customProviderModel || ''
  });
  const [customProviderModels, setCustomProviderModels] = useState<string[]>([]);
  const [isLoadingCustomModels, setIsLoadingCustomModels] = useState(false);
  const [customProviderError, setCustomProviderError] = useState<string | null>(null);
  const [requiresApiKey, setRequiresApiKey] = useState(!!data.customProviderKey);
  
  // AI Parameters
  const [temperature, setTemperature] = useState(data.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(data.maxTokens || 4000);
  const [maxRetries, setMaxRetries] = useState(data.maxRetries || 3);
  
  // Advanced settings
  const [enableSelfCorrection, setEnableSelfCorrection] = useState(data.enableSelfCorrection !== false);
  const [enableChainOfThought, setEnableChainOfThought] = useState(data.enableChainOfThought !== false);
  const [enableToolGuidance, setEnableToolGuidance] = useState(data.enableToolGuidance !== false);
  const [maxToolCalls, setMaxToolCalls] = useState(data.maxToolCalls || 10);
  const [confidenceThreshold] = useState(data.confidenceThreshold || 0.7);
  
  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMCPConfig, setShowMCPConfig] = useState(false);
  
  // Phase 2: Enhanced execution state
  const [isExecuting, setIsExecuting] = useState(data.isExecuting || false);
  const [executionLogs, setExecutionLogs] = useState<string[]>(data.executionLogs || []);
  const [lastResult, setLastResult] = useState(data.lastExecutionResult || null);
  const [currentSteps, setCurrentSteps] = useState<ExecutionStep[]>(data.currentSteps || []);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>(data.executionHistory || []);
  const [enableRealTimeMonitoring] = useState(data.enableRealTimeMonitoring !== false);
  
  // Available providers and models (loaded from Clara services)
  const [availableProviders, setAvailableProviders] = useState<ClaraProvider[]>([]);
  const [availableModels, setAvailableModels] = useState<ClaraModel[]>([]);
  const [availableMCPServers, setAvailableMCPServers] = useState<string[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Update data callback
  const updateData = useCallback((updates: Partial<AgentExecutorNodeData>) => {
    console.log('🔄 AgentExecutorNode updateData called with:', updates);
    if (data.onUpdate) {
      const newData = { ...data, ...updates };
      console.log('📝 Saving node data:', newData);
      data.onUpdate({ data: newData });
    } else {
      console.warn('⚠️ No onUpdate callback available');
    }
  }, [data]);

  // Helper function to ensure MCP servers are running before execution
  const ensureMCPServersRunning = useCallback(async (requiredServers: string[]) => {
    if (!window.mcpService || requiredServers.length === 0) return;
    
    try {
      const servers = await window.mcpService.getServers();
      const serversToStart: string[] = [];
      
      for (const serverName of requiredServers) {
        const server = servers.find(s => s.name === serverName);
        if (server && !server.isRunning) {
          serversToStart.push(serverName);
        }
      }
      
      if (serversToStart.length > 0) {
        if (enableRealTimeMonitoring) {
          setExecutionLogs(prev => [...prev, `🔧 Starting MCP servers: ${serversToStart.join(', ')}`]);
        }
        
        for (const serverName of serversToStart) {
          try {
            await window.mcpService.startServer(serverName);
            if (enableRealTimeMonitoring) {
              setExecutionLogs(prev => [...prev, `✅ Started MCP server: ${serverName}`]);
            }
          } catch (error) {
            if (enableRealTimeMonitoring) {
              setExecutionLogs(prev => [...prev, `❌ Failed to start MCP server ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`]);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to ensure MCP servers are running:', error);
    }
  }, [enableRealTimeMonitoring]);

  // Load providers and models on mount
  useEffect(() => {
    const loadProvidersAndModels = async () => {
      setIsLoadingConfig(true);
      try {
        // Load providers
        const providers = await claraApiService.getProviders();
        setAvailableProviders(providers);
        
        // Load all models
        const allModels: ClaraModel[] = [];
        for (const providerData of providers) {
          try {
            const models = await claraApiService.getModels(providerData.id);
            allModels.push(...models);
          } catch (error) {
            console.warn(`Failed to load models for provider ${providerData.id}:`, error);
          }
        }
        setAvailableModels(allModels);
        
        // 🚀 PHASE 2: Load REAL MCP servers from electron service
        try {
          if (window.mcpService) {
            const mcpServers = await window.mcpService.getServers();
            const runningServerNames = mcpServers
              .filter(server => server.isRunning && server.status === 'running')
              .map(server => server.name);
            
            console.log(`Loaded ${mcpServers.length} MCP servers, ${runningServerNames.length} running`);
            
            // If servers are running, prioritize them, otherwise show all available
            if (runningServerNames.length > 0) {
              setAvailableMCPServers(runningServerNames);
            } else {
              const allServerNames = mcpServers.map(server => server.name);
              setAvailableMCPServers(allServerNames);
              console.log(`No MCP servers running, showing all ${allServerNames.length} available servers`);
            }
            
            // Auto-enable running servers for new nodes
            if (enabledMCPServers.length === 0 && runningServerNames.length > 0) {
              setEnabledMCPServers(runningServerNames.slice(0, 3)); // Enable first 3 running servers
              updateData({ enabledMCPServers: runningServerNames.slice(0, 3) });
            }
          } else {
            console.warn('MCP service not available, using fallback servers');
            // Fallback to common MCP server names
            setAvailableMCPServers([
              'filesystem', 'web-search', 'python-executor', 
              'database', 'git-manager', 'image-processor'
            ]);
          }
        } catch (mcpError) {
          console.warn('Failed to load MCP servers:', mcpError);
          // Fallback to basic server list
          setAvailableMCPServers([
            'filesystem', 'web-search', 'python-executor'
          ]);
        }
        
        // Set default provider and model if none selected
        if (!provider && providers.length > 0) {
          const defaultProvider = providers.find(p => p.type === 'claras-pocket') || providers[0];
          setProvider(defaultProvider.id);
          updateData({ provider: defaultProvider.id });
          
          const providerModels = allModels.filter(m => m.provider === defaultProvider.id);
          if (providerModels.length > 0 && !model) {
            setModel(providerModels[0].id);
            updateData({ textModel: providerModels[0].id });
          }
        }
        
      } catch (error) {
        console.error('Failed to load providers and models:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

        loadProvidersAndModels();
      }, [provider, model, updateData]);  // Get models for selected provider
  const getProviderModels = useCallback((providerIdFilter?: string) => {
    const targetProvider = providerIdFilter || provider;
    return availableModels.filter(m => m.provider === targetProvider);
  }, [availableModels, provider]);

  // Fetch models from custom provider
  const fetchCustomProviderModels = useCallback(async (baseUrl: string, apiKey?: string) => {
    if (!baseUrl.trim()) {
      setCustomProviderModels([]);
      setCustomProviderError(null);
      return;
    }

    setIsLoadingCustomModels(true);
    setCustomProviderError(null);
    
    try {
      // Normalize the base URL - ensure it ends with /models
      let modelsUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
      if (!modelsUrl.endsWith('/models')) {
        modelsUrl += '/models';
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Only add Authorization header if API key is provided and required
      if (apiKey && requiresApiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle different API response formats
      let models: string[] = [];
      if (data.data && Array.isArray(data.data)) {
        // OpenAI format: { data: [{ id: "model-name" }, ...] }
        models = data.data.map((model: any) => model.id || model.name).filter(Boolean);
      } else if (data.models && Array.isArray(data.models)) {
        // Ollama format: { models: [{ name: "model-name" }, ...] }
        models = data.models.map((model: any) => model.name || model.id).filter(Boolean);
      } else if (Array.isArray(data)) {
        // Direct array format
        models = data.map((model: any) => {
          if (typeof model === 'string') return model;
          return model.id || model.name;
        }).filter(Boolean);
      }

      if (models.length === 0) {
        setCustomProviderError('No models found. Please check your API endpoint and key.');
      } else {
        setCustomProviderModels(models);
        if (enableRealTimeMonitoring) {
          setExecutionLogs(prev => [...prev, `🎯 Found ${models.length} models from custom provider`]);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models';
      setCustomProviderError(errorMessage);
      setCustomProviderModels([]);
      console.error('Failed to fetch custom provider models:', error);
    } finally {
      setIsLoadingCustomModels(false);
    }
  }, [enableRealTimeMonitoring, setExecutionLogs]);

  // Auto-fetch custom provider models on mount if data is available
  useEffect(() => {
    if (useCustomProvider && customProvider.baseUrl && customProviderModels.length === 0) {
      // Fetch models if we have URL and either don't require API key or have one
      if (!requiresApiKey || customProvider.apiKey) {
        fetchCustomProviderModels(customProvider.baseUrl, customProvider.apiKey);
      }
    }
  }, [useCustomProvider, customProvider.baseUrl, customProvider.apiKey, customProviderModels.length, fetchCustomProviderModels, requiresApiKey]);

  // Handle custom provider toggle
  const handleCustomProviderToggle = useCallback((enabled: boolean) => {
    setUseCustomProvider(enabled);
    if (enabled) {
      // Clear regular provider when switching to custom
      setProvider('custom');
    } else {
      // Reset custom provider data
      setCustomProvider({
        name: '',
        baseUrl: '',
        apiKey: '',
        model: ''
      });
      // Reset to first available provider
      if (availableProviders.length > 0) {
        setProvider(availableProviders[0].id);
      }
    }
    updateData({ 
      useCustomProvider: enabled,
      provider: enabled ? 'custom' : (availableProviders.length > 0 ? availableProviders[0].id : ''),
      // Clear custom provider data when disabled
      ...(enabled ? {} : {
        customProviderName: '',
        customProviderUrl: '',
        customProviderKey: '',
        customProviderModel: ''
      })
    });
  }, [availableProviders, updateData]);

  // Handle custom provider field updates
  const handleCustomProviderUpdate = useCallback((field: string, value: string) => {
    console.log(`🔧 Custom provider field update: ${field} = "${value}"`);
    
    const updatedProvider = { ...customProvider, [field]: value };
    console.log('📦 Updated provider object:', updatedProvider);
    setCustomProvider(updatedProvider);
    
    // Map field names to the correct data property names
    const fieldMapping: Record<string, string> = {
      name: 'customProviderName',
      baseUrl: 'customProviderUrl',
      apiKey: 'customProviderKey',
      model: 'customProviderModel'
    };
    
    const dataProperty = fieldMapping[field];
    if (dataProperty) {
      console.log(`📝 Mapping ${field} -> ${dataProperty}: "${value}"`);
      const updates: any = { 
        [dataProperty]: value
      };
      
      // For model selection, also update textModel for consistency
      if (field === 'model') {
        updates.textModel = value;
        console.log(`📝 Also updating textModel: "${value}"`);
      }
      
      console.log('💾 Calling updateData with:', updates);
      updateData(updates);
    } else {
      console.warn(`⚠️ Unknown field: ${field}`);
    }

    // Auto-fetch models when URL is provided (and API key if required)
    if ((field === 'baseUrl' || field === 'apiKey') && updatedProvider.baseUrl) {
      // Fetch models if we have URL and either don't require API key or have one
      if (!requiresApiKey || updatedProvider.apiKey) {
        fetchCustomProviderModels(updatedProvider.baseUrl, updatedProvider.apiKey);
      }
    }

    // Clear models if URL is removed
    if (field === 'baseUrl' && !updatedProvider.baseUrl) {
      setCustomProviderModels([]);
      setCustomProviderError(null);
    }
  }, [customProvider, updateData, fetchCustomProviderModels, requiresApiKey]);

  // Handle API key requirement toggle
  const handleApiKeyRequirementToggle = useCallback((required: boolean) => {
    setRequiresApiKey(required);
    if (!required) {
      // Clear API key if not required
      const updatedProvider = { ...customProvider, apiKey: '' };
      setCustomProvider(updatedProvider);
      updateData({ customProviderKey: '' });
      
      // Re-fetch models without API key if URL is available
      if (updatedProvider.baseUrl) {
        fetchCustomProviderModels(updatedProvider.baseUrl);
      }
    }
  }, [customProvider, updateData, fetchCustomProviderModels]);

  // Handle provider change
  const handleProviderChange = useCallback((newProvider: string) => {
    setProvider(newProvider);
    
    // Reset models when provider changes
    const providerModels = getProviderModels(newProvider);
    if (providerModels.length > 0) {
      const newModel = providerModels[0].id;
      setModel(newModel);
      updateData({ 
        provider: newProvider, 
        textModel: newModel,
        visionModel: newModel,
        codeModel: newModel
      });
    } else {
      updateData({ provider: newProvider });
    }
  }, [getProviderModels, updateData]);

  // Handle model changes
  const handleModelChange = useCallback((modelId: string) => {
    setModel(modelId);
    updateData({ 
      textModel: modelId,
      visionModel: modelId,
      codeModel: modelId
    });
  }, [updateData]);

  // Handle MCP server toggle
  const handleMCPServerToggle = useCallback((serverName: string) => {
    const newServers = enabledMCPServers.includes(serverName)
      ? enabledMCPServers.filter(s => s !== serverName)
      : [...enabledMCPServers, serverName];
    
    setEnabledMCPServers(newServers);
    updateData({ enabledMCPServers: newServers });
  }, [enabledMCPServers, updateData]);

  // Handle instructions change
  const handleInstructionsChange = useCallback((value: string) => {
    setInstructions(value);
    updateData({ instructions: value });
  }, [updateData]);

  // Enhanced executeAgent with Phase 2 features - Multi-step execution and real-time monitoring
  const executeAgent = useCallback(async (taskInstructions: string) => {
    console.log('🚀 Starting Agent Execution');
    console.log('📊 Current State:', {
      useCustomProvider,
      provider,
      model,
      customProvider: {
        name: customProvider.name,
        baseUrl: customProvider.baseUrl,
        model: customProvider.model,
        hasApiKey: !!customProvider.apiKey
      },
      savedData: {
        customProviderName: data.customProviderName,
        customProviderUrl: data.customProviderUrl,
        customProviderModel: data.customProviderModel,
        textModel: data.textModel
      }
    });

    // Validate inputs based on provider type
    if (useCustomProvider) {
      if (!customProvider.baseUrl || !customProvider.model || !taskInstructions.trim()) {
        throw new Error('Custom provider URL, model, and instructions are required');
      }
      if (requiresApiKey && !customProvider.apiKey) {
        throw new Error('API key is required for this provider');
      }
    } else {
      if (!provider || !model || !taskInstructions.trim()) {
        throw new Error('Provider, model, and instructions are required');
      }
    }

    setIsExecuting(true);
    setExecutionLogs([]);
    setCurrentSteps([]);
    
    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // Phase 2: Create execution steps for multi-step processing
      const steps: ExecutionStep[] = [
        { id: 'planning', description: 'Planning task execution', status: 'pending' },
        { id: 'preparation', description: 'Preparing tools and context', status: 'pending' },
        { id: 'execution', description: 'Executing main task', status: 'pending' },
        { id: 'validation', description: 'Validating results', status: 'pending' },
        { id: 'completion', description: 'Finalizing output', status: 'pending' }
      ];
      
      setCurrentSteps(steps);
      
      // Update step helper
      const updateStep = (stepId: string, updates: Partial<ExecutionStep>) => {
        setCurrentSteps(prev => prev.map(step => 
          step.id === stepId ? { ...step, ...updates } : step
        ));
      };
      
      // Step 1: Planning
      updateStep('planning', { status: 'running', startTime: Date.now() });
      if (enableRealTimeMonitoring) {
        setExecutionLogs(prev => [...prev, '📋 Planning task execution...']);
      }
      
      // Create agent service instance
      const agentService = new ClaraAgentExecutionService();
      
      // Step 2: Preparation
      updateStep('planning', { status: 'completed', endTime: Date.now() });
      updateStep('preparation', { status: 'running', startTime: Date.now() });
      
      if (enableRealTimeMonitoring) {
        setExecutionLogs(prev => [...prev, '🔧 Preparing tools and context...']);
      }

      // 🚀 PHASE 2: Ensure required MCP servers are running
      if (enabledMCPServers.length > 0) {
        await ensureMCPServersRunning(enabledMCPServers);
      }

      // Create agent execution config
      const agentConfig: AgentExecutionConfig = useCustomProvider ? {
        provider: 'custom',
        textModel: data.customProviderModel || customProvider.model,
        visionModel: data.customProviderModel || customProvider.model,
        codeModel: data.customProviderModel || customProvider.model,
        customProviderUrl: data.customProviderUrl || customProvider.baseUrl,
        customProviderKey: data.customProviderKey || customProvider.apiKey,
        enabledMCPServers,
        temperature,
        maxTokens,
        maxRetries,
        enableSelfCorrection,
        enableChainOfThought,
        enableToolGuidance,
        maxToolCalls,
        confidenceThreshold
      } : {
        provider,
        textModel: model,
        visionModel: model,
        codeModel: model,
        enabledMCPServers,
        temperature,
        maxTokens,
        maxRetries,
        enableSelfCorrection,
        enableChainOfThought,
        enableToolGuidance,
        maxToolCalls,
        confidenceThreshold
      };

      console.log('🎯 Agent Execution Config (useCustomProvider:', useCustomProvider, '):', {
        provider: agentConfig.provider,
        textModel: agentConfig.textModel,
        customProviderUrl: agentConfig.customProviderUrl,
        dataSources: {
          'data.customProviderModel': data.customProviderModel,
          'customProvider.model': customProvider.model,
          'data.customProviderUrl': data.customProviderUrl,
          'customProvider.baseUrl': customProvider.baseUrl
        },
        customProvider: useCustomProvider ? {
          model: customProvider.model,
          baseUrl: customProvider.baseUrl,
          apiKey: customProvider.apiKey ? '[REDACTED]' : undefined
        } : 'N/A'
      });

      console.log('🚨 CRITICAL DEBUG - Final Agent Config:', JSON.stringify(agentConfig, null, 2));

      updateStep('preparation', { status: 'completed', endTime: Date.now() });
      updateStep('execution', { status: 'running', startTime: Date.now() });
      
      if (enableRealTimeMonitoring) {
        setExecutionLogs(prev => [...prev, '🚀 Executing main task...']);
      }

      // Step 3: Main execution with real-time monitoring
      const result = await agentService.executeAgent(
        taskInstructions,
        agentConfig
      );

      updateStep('execution', { 
        status: 'completed', 
        endTime: Date.now(),
        result: result.content
      });
      updateStep('validation', { status: 'running', startTime: Date.now() });
      
      if (enableRealTimeMonitoring) {
        setExecutionLogs(prev => [...prev, '✅ Task execution completed']);
        setExecutionLogs(prev => [...prev, '🔍 Validating results...']);
      }

      // Step 4: Validation (enhanced for Phase 2)
      let validationResult = result;
      if (enableSelfCorrection && !result.success) {
        if (enableRealTimeMonitoring) {
          setExecutionLogs(prev => [...prev, '🔄 Self-correction triggered...']);
        }
        
        // Retry with corrected approach
        const retryInstructions = `Previous attempt failed: ${result.executionLog}\n\nPlease retry with corrected approach: ${taskInstructions}`;
        validationResult = await agentService.executeAgent(
          retryInstructions,
          { ...agentConfig, maxRetries: Math.max(agentConfig.maxRetries - 1, 1) }
        );
      }

      updateStep('validation', { status: 'completed', endTime: Date.now() });
      updateStep('completion', { status: 'running', startTime: Date.now() });
      
      // Step 5: Completion and history tracking
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const executionRecord: ExecutionHistory = {
        id: executionId,
        timestamp: startTime,
        instructions: taskInstructions,
        config: agentConfig,
        status: validationResult.success ? 'success' : 'failed',
        duration,
        steps: [...steps],
        result: validationResult,
        error: validationResult.success ? undefined : validationResult.executionLog
      };
      
      setExecutionHistory(prev => [executionRecord, ...prev.slice(0, 9)]); // Keep last 10 executions
      updateStep('completion', { status: 'completed', endTime });

      // Update logs with the execution log from the service
      const logs = validationResult.executionLog.split('\n');
      setExecutionLogs(prev => [...prev, ...logs]);
      
      setLastResult(validationResult);
      updateData({ 
        lastExecutionResult: validationResult,
        executionLogs: logs,
        currentSteps: steps,
        executionHistory: [executionRecord, ...executionHistory.slice(0, 9)]
      });

      if (enableRealTimeMonitoring) {
        setExecutionLogs(prev => [...prev, `🎯 Execution completed in ${duration}ms`]);
      }

      return validationResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update current step with error
      setCurrentSteps(prev => prev.map(step => 
        step.status === 'running' 
          ? { ...step, status: 'failed', error: errorMessage, endTime: Date.now() }
          : step
      ));
      
      const errorResult = {
        success: false,
        content: `Agent execution failed: ${errorMessage}`,
        executionLog: `❌ Agent execution failed: ${errorMessage}`
      };
      
      setExecutionLogs([errorResult.executionLog]);
      setLastResult(errorResult);
      updateData({ 
        lastExecutionResult: errorResult,
        executionLogs: [errorResult.executionLog]
      });
      throw error;
    } finally {
      setIsExecuting(false);
      updateData({ isExecuting: false });
    }
  }, [
    provider, model, useCustomProvider, customProvider, requiresApiKey, enabledMCPServers,
    temperature, maxTokens, maxRetries, enableSelfCorrection,
    enableChainOfThought, enableToolGuidance, maxToolCalls,
    confidenceThreshold, updateData, enableRealTimeMonitoring,
    executionHistory, ensureMCPServersRunning
  ]);

  // Get current provider models for dropdown
  const currentProviderModels = getProviderModels();
  const textModels = currentProviderModels;

  return (
    <BaseNode
      {...props}
      title="Agent Executor"
      category="ai"
      icon={
        <div className="flex items-center gap-1">
          <Bot className="w-4 h-4" />
          {isExecuting && <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />}
        </div>
      }
      inputs={[
        { id: 'instructions', name: 'Instructions', type: 'input', dataType: 'string', required: true },
        { id: 'context', name: 'Context', type: 'input', dataType: 'string', required: false },
        { id: 'attachments', name: 'Attachments', type: 'input', dataType: 'array', required: false }
      ]}
      outputs={[
        { id: 'result', name: 'Result', type: 'output', dataType: 'string' },
        { id: 'executionLog', name: 'Execution Log', type: 'output', dataType: 'string' },
        { id: 'success', name: 'Success', type: 'output', dataType: 'boolean' }
      ]}
      executing={isExecuting}
      success={lastResult && !lastResult.error}
      error={lastResult?.error}
    >
      <div className="space-y-4">
        {/* Loading State */}
        {isLoadingConfig && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-sakura-500 rounded-full animate-spin" />
              Loading providers and models...
            </div>
          </div>
        )}

        {/* Provider Selection */}
        {!isLoadingConfig && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🏢 Provider
            </label>
            
            {/* Provider Type Toggle */}
            <div className="mb-3 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="providerType"
                  checked={!useCustomProvider}
                  onChange={() => handleCustomProviderToggle(false)}
                  className="text-sakura-600 focus:ring-sakura-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Use Settings Provider</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="providerType"
                  checked={useCustomProvider}
                  onChange={() => handleCustomProviderToggle(true)}
                  className="text-sakura-600 focus:ring-sakura-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Custom Provider</span>
              </label>
            </div>

            {/* Settings Provider Selection */}
            {!useCustomProvider && (
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all"
              >
                <option value="">Select Provider</option>
                {availableProviders.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name} ({prov.type})
                  </option>
                ))}
              </select>
            )}

            {/* Custom Provider Configuration */}
            {useCustomProvider && (
              <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                    Provider Name
                  </label>
                  <input
                    type="text"
                    value={customProvider.name}
                    onChange={(e) => handleCustomProviderUpdate('name', e.target.value)}
                    placeholder="e.g., My Custom Provider"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all border border-blue-300 dark:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                    Base URL
                  </label>
                  <input
                    type="url"
                    value={customProvider.baseUrl}
                    onChange={(e) => handleCustomProviderUpdate('baseUrl', e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all border border-blue-300 dark:border-blue-700"
                  />
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Examples: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">https://api.openai.com/v1</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">http://localhost:11434/v1</code>
                  </div>
                </div>
                
                {/* API Key Requirement Toggle */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresApiKey}
                      onChange={(e) => handleApiKeyRequirementToggle(e.target.checked)}
                      className="rounded border-gray-300 text-sakura-600 focus:ring-sakura-500"
                    />
                    <span className="text-xs text-blue-700 dark:text-blue-300">Requires API Key</span>
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (Uncheck for local APIs like Ollama)
                  </span>
                </div>
                
                {/* API Key Field */}
                {requiresApiKey && (
                  <div>
                    <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={customProvider.apiKey}
                      onChange={(e) => handleCustomProviderUpdate('apiKey', e.target.value)}
                      placeholder="Your API key"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all border border-blue-300 dark:border-blue-700"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                    Model Name
                  </label>
                  {customProviderModels.length > 0 ? (
                    <select
                      value={customProvider.model}
                      onChange={(e) => handleCustomProviderUpdate('model', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all border border-blue-300 dark:border-blue-700"
                    >
                      <option value="">Select a model</option>
                      {customProviderModels.map((modelName) => (
                        <option key={modelName} value={modelName}>
                          {modelName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={customProvider.model}
                      onChange={(e) => handleCustomProviderUpdate('model', e.target.value)}
                      placeholder="e.g., gpt-4, llama2, claude-3"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all border border-blue-300 dark:border-blue-700"
                    />
                  )}
                  {isLoadingCustomModels && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-blue-600 dark:text-blue-400">
                      <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span>Loading models...</span>
                    </div>
                  )}
                  {customProviderError && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {customProviderError}
                    </div>
                  )}
                  {customProviderModels.length > 0 && !isLoadingCustomModels && (
                    <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                      ✅ Found {customProviderModels.length} models
                    </div>
                  )}
                </div>
                {customProvider.baseUrl && customProvider.apiKey && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => fetchCustomProviderModels(customProvider.baseUrl, requiresApiKey ? customProvider.apiKey : undefined)}
                      disabled={isLoadingCustomModels}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isLoadingCustomModels ? (
                        <>
                          <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          🔄 Refresh Models
                        </>
                      )}
                    </button>
                  </div>
                )}
                <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 p-2 rounded">
                  💡 This provider will only be used for this specific node and won't be saved to your global settings.
                  <br />
                  🔄 Models will be automatically fetched when you provide the URL (and API key if required).
                  <br />
                  🏠 For local APIs like Ollama, uncheck "Requires API Key" and just provide the URL.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Model Selection */}
        {((provider && !useCustomProvider) || (useCustomProvider && customProvider.model)) && !isLoadingConfig && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🧠 Model
            </label>
            {useCustomProvider ? (
              <div className="px-3 py-2 text-sm rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {customProvider.model || 'No model specified'}
              </div>
            ) : (
              <select
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all"
              >
                <option value="">Select Model</option>
                {textModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📋 Agent Instructions
          </label>
          <textarea
            value={instructions}
            onChange={(e) => handleInstructionsChange(e.target.value)}
            placeholder="Describe the task for the autonomous agent to complete..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 resize-none transition-all"
          />
        </div>

        {/* MCP Configuration */}
        <button
          onClick={() => setShowMCPConfig(!showMCPConfig)}
          className="w-full px-3 py-2.5 text-sm bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors font-medium flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            MCP Tools ({enabledMCPServers.length} enabled)
          </span>
          <span>{showMCPConfig ? '▼' : '▶'}</span>
        </button>

        {showMCPConfig && (
          <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              Select MCP servers to enable tool access:
            </div>
            {availableMCPServers.map((serverName) => (
              <label key={serverName} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledMCPServers.includes(serverName)}
                  onChange={() => handleMCPServerToggle(serverName)}
                  className="rounded border-gray-300 text-sakura-600 focus:ring-sakura-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {serverName}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Advanced Settings */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Advanced Settings
          </span>
          <span>{showAdvanced ? '▼' : '▶'}</span>
        </button>

        {showAdvanced && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            {/* Temperature & Max Tokens */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature
                </label>
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTemperature(val);
                      updateData({ temperature: val });
                    }}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-center text-gray-500 dark:text-gray-400 font-mono">
                    {temperature}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="100"
                  max="8000"
                  value={maxTokens}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMaxTokens(val);
                    updateData({ maxTokens: val });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all"
                />
              </div>
            </div>

            {/* Agent Behavior Settings */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Agent Behavior</div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSelfCorrection}
                  onChange={(e) => {
                    setEnableSelfCorrection(e.target.checked);
                    updateData({ enableSelfCorrection: e.target.checked });
                  }}
                  className="rounded border-gray-300 text-sakura-600 focus:ring-sakura-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Self-Correction</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableChainOfThought}
                  onChange={(e) => {
                    setEnableChainOfThought(e.target.checked);
                    updateData({ enableChainOfThought: e.target.checked });
                  }}
                  className="rounded border-gray-300 text-sakura-600 focus:ring-sakura-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Chain of Thought</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableToolGuidance}
                  onChange={(e) => {
                    setEnableToolGuidance(e.target.checked);
                    updateData({ enableToolGuidance: e.target.checked });
                  }}
                  className="rounded border-gray-300 text-sakura-600 focus:ring-sakura-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Tool Guidance</span>
              </label>
            </div>

            {/* Execution Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Tool Calls
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxToolCalls}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMaxToolCalls(val);
                    updateData({ maxToolCalls: val });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Retries
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={maxRetries}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMaxRetries(val);
                    updateData({ maxRetries: val });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sakura-500 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Execution Status */}
        {(isExecuting || lastResult) && (
          <div className="space-y-2">
            {isExecuting && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 mb-2">
                  <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Executing Agent...</span>
                </div>
                {enableRealTimeMonitoring && currentSteps.length > 0 && (
                  <div className="space-y-1">
                    {currentSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-2 text-xs">
                        {step.status === 'completed' ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : step.status === 'running' ? (
                          <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        ) : step.status === 'failed' ? (
                          <AlertCircle className="w-3 h-3 text-red-500" />
                        ) : (
                          <div className="w-3 h-3 border border-gray-300 rounded-full" />
                        )}
                        <span className={`${
                          step.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                          step.status === 'running' ? 'text-yellow-600 dark:text-yellow-400' :
                          step.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                          'text-gray-500 dark:text-gray-400'
                        }`}>
                          {step.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Execution Logs */}
            {executionLogs.length > 0 && (
              <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono max-h-32 overflow-y-auto">
                {executionLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {/* Result Status */}
            {lastResult && !isExecuting && (
              <div className={`p-3 rounded-lg ${lastResult.error ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                <div className={`flex items-center gap-2 ${lastResult.error ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                  {lastResult.error ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {lastResult.error ? 'Execution Failed' : 'Execution Completed'}
                  </span>
                </div>
                {lastResult.error && (
                  <div className="text-xs mt-1 text-red-600 dark:text-red-400">
                    {lastResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Test Button */}
        {((provider && model && !useCustomProvider) || 
          (useCustomProvider && customProvider.baseUrl && customProvider.model && (!requiresApiKey || customProvider.apiKey))) && 
          instructions && !isExecuting && (
          <button
            onClick={() => executeAgent(instructions)}
            className="w-full px-3 py-2.5 bg-gradient-to-r from-sakura-500 to-pink-500 hover:from-sakura-600 hover:to-pink-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Test Agent Execution
          </button>
        )}
      </div>
    </BaseNode>
  );
});

AgentExecutorNode.displayName = 'AgentExecutorNode';

export default AgentExecutorNode;
