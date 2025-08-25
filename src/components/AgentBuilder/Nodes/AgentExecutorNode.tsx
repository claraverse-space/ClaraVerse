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
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Phase 2: Enhanced execution state
  const [isExecuting, setIsExecuting] = useState(data.isExecuting || false);
  const [executionLogs, setExecutionLogs] = useState<string[]>(data.executionLogs || []);
  const [lastResult, setLastResult] = useState(data.lastExecutionResult || null);
  const [currentSteps, setCurrentSteps] = useState<ExecutionStep[]>(data.currentSteps || []);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>(data.executionHistory || []);
  const [enableMultiStep, setEnableMultiStep] = useState(data.enableMultiStep !== false);
  const [enableRealTimeMonitoring, setEnableRealTimeMonitoring] = useState(data.enableRealTimeMonitoring !== false);
  
  // Phase 2: Agent templates
  const [agentTemplates] = useState<AgentTemplate[]>([
    {
      id: 'data-analyst',
      name: 'Data Analyst',
      description: 'Analyze data, create visualizations, and generate insights',
      category: 'analysis',
      instructions: 'You are a data analyst. Analyze the provided data and create comprehensive insights with visualizations.',
      config: {
        provider: 'claras-pocket',
        textModel: 'llama3.2:latest',
        enabledMCPServers: ['filesystem', 'python-executor'],
        temperature: 0.3,
        maxTokens: 6000,
        enableChainOfThought: true,
        maxToolCalls: 15
      }
    },
    {
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'Review code for bugs, performance, and best practices',
      category: 'coding',
      instructions: 'You are a senior code reviewer. Analyze the code for bugs, security issues, performance problems, and suggest improvements.',
      config: {
        provider: 'claras-pocket',
        textModel: 'llama3.2:latest',
        codeModel: 'codellama:latest',
        enabledMCPServers: ['filesystem', 'git-manager'],
        temperature: 0.2,
        maxTokens: 8000,
        enableToolGuidance: true,
        maxToolCalls: 20
      }
    },
    {
      id: 'content-creator',
      name: 'Content Creator',
      description: 'Generate high-quality content for various platforms',
      category: 'content',
      instructions: 'You are a creative content creator. Generate engaging, high-quality content tailored to the target audience and platform.',
      config: {
        provider: 'claras-pocket',
        textModel: 'llama3.2:latest',
        enabledMCPServers: ['web-search', 'image-processor'],
        temperature: 0.8,
        maxTokens: 5000,
        enableChainOfThought: true,
        maxToolCalls: 10
      }
    },
    {
      id: 'automation-specialist',
      name: 'Automation Specialist',
      description: 'Automate tasks and create efficient workflows',
      category: 'automation',
      instructions: 'You are an automation specialist. Create efficient automated solutions and workflows for the given task.',
      config: {
        provider: 'claras-pocket',
        textModel: 'llama3.2:latest',
        enabledMCPServers: ['filesystem', 'python-executor', 'database'],
        temperature: 0.4,
        maxTokens: 7000,
        enableSelfCorrection: true,
        maxToolCalls: 25
      }
    }
  ]);
  
  // Available providers and models (loaded from Clara services)
  const [availableProviders, setAvailableProviders] = useState<ClaraProvider[]>([]);
  const [availableModels, setAvailableModels] = useState<ClaraModel[]>([]);
  const [availableMCPServers, setAvailableMCPServers] = useState<string[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Update data callback
  const updateData = useCallback((updates: Partial<AgentExecutorNodeData>) => {
    if (data.onUpdate) {
      data.onUpdate({ data: { ...data, ...updates } });
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
  }, [provider, model, updateData]);

  // Get models for selected provider
  const getProviderModels = useCallback((providerIdFilter?: string) => {
    const targetProvider = providerIdFilter || provider;
    return availableModels.filter(m => m.provider === targetProvider);
  }, [availableModels, provider]);

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
    if (!provider || !model || !taskInstructions.trim()) {
      throw new Error('Provider, model, and instructions are required');
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
      const agentConfig: AgentExecutionConfig = {
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
    provider, model, enabledMCPServers,
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
          </div>
        )}

        {/* Model Selection */}
        {provider && !isLoadingConfig && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🧠 Model
            </label>
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
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                  <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Executing Agent...</span>
                </div>
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
        {provider && model && instructions && !isExecuting && (
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
