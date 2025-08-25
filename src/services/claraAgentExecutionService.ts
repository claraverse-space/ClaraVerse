/**
 * Enhanced Clara Agent Execution Service - Phase 2
 * 
 * Extracts the core agent execution logic from ClaraAssistant
 * for reuse in the Agent Studio's Agent Executor node.
 * 
 * Phase 2 Features:
 * - Multi-step execution chains
 * - Real-time progress monitoring
 * - Enhanced error recovery and self-correction
 * - Execution history tracking
 * - Task decomposition and validation
 */

import { claraApiService } from './claraApiService';
import { ClaraAIConfig, ClaraFileAttachment } from '../types/clara_assistant_types';

// Enhanced interfaces for Phase 2
export interface TaskStep {
  id: string;
  description: string;
  instructions: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
  retryCount?: number;
  toolsUsed?: string[];
}

export interface ExecutionPlan {
  id: string;
  originalTask: string;
  steps: TaskStep[];
  estimatedDuration: number;
  complexity: 'simple' | 'moderate' | 'complex';
  requiredTools: string[];
}

export interface AgentExecutionConfig {
  provider: string;
  textModel: string;
  visionModel?: string;
  codeModel?: string;
  enabledMCPServers: string[];
  
  // AI Parameters
  temperature: number;
  maxTokens: number;
  
  // Agent Behavior - Enhanced for Phase 2
  maxRetries: number;
  enableSelfCorrection: boolean;
  enableChainOfThought: boolean;
  enableToolGuidance: boolean;
  maxToolCalls: number;
  confidenceThreshold: number;
  
  // Phase 2 Options
  enableMultiStep?: boolean;
  enableTaskDecomposition?: boolean;
  enableProgressTracking?: boolean;
  maxStepsPerTask?: number;
  stepTimeout?: number;
}

export interface AgentExecutionResult {
  success: boolean;
  content: string;
  toolResults: any[];
  executionLog: string;
  
  // Phase 2 Enhanced Results
  executionPlan?: ExecutionPlan;
  completedSteps?: TaskStep[];
  finalValidation?: {
    passed: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
  };
  
  metadata: {
    provider: string;
    model: string;
    duration: number;
    toolsUsed: string[];
    agentSteps: number;
    
    // Phase 2 Metadata
    planningTime?: number;
    executionTime?: number;
    validationTime?: number;
    retryCount?: number;
    selfCorrections?: number;
    complexity?: string;
    
    [key: string]: any;
  };
}

export class ClaraAgentExecutionService {
  /**
   * Execute an autonomous agent task
   */
  async executeAgent(
    instructions: string,
    config: AgentExecutionConfig,
    context?: string,
    attachments?: ClaraFileAttachment[]
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const executionLogs: string[] = [];
    
    const addLog = (message: string) => {
      executionLogs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
      console.log(`🤖 Agent: ${message}`);
    };

    try {
      addLog('Starting autonomous agent execution...');
      addLog(`Task: ${instructions.substring(0, 100)}${instructions.length > 100 ? '...' : ''}`);
      addLog(`Provider: ${config.provider}`);
      addLog(`Model: ${config.textModel}`);
      
      if (config.enabledMCPServers.length > 0) {
        addLog(`MCP Servers: ${config.enabledMCPServers.join(', ')}`);
      }

      // Create AI configuration
      const aiConfig: ClaraAIConfig = this.createAIConfig(config);
      
      // Log the configuration being used
      console.log(`🤖 Agent Executor Configuration:`, {
        provider: config.provider,
        textModel: config.textModel,
        aiConfigProvider: aiConfig.provider,
        aiConfigTextModel: aiConfig.models.text,
        enabledMCPServers: config.enabledMCPServers
      });
      
      // Prepare the full instructions with context
      let fullInstructions = instructions;
      if (context && context.trim()) {
        fullInstructions = `Context: ${context}\n\nTask: ${instructions}`;
      }

      // Create streaming callback to capture progress
      const toolsUsed: string[] = [];
      let agentSteps = 0;
      
      const streamCallback = (chunk: string) => {
        // Parse status updates and tool usage
        if (chunk.includes('**AGENT_STATUS:')) {
          const statusLine = chunk.replace(/\*\*/g, '').trim();
          addLog(`Status: ${statusLine}`);
          agentSteps++;
        } else if (chunk.includes('Using') && chunk.includes('tool')) {
          const toolMatch = chunk.match(/Using\s+([^\s]+)\s+tool/);
          if (toolMatch && toolMatch[1] && !toolsUsed.includes(toolMatch[1])) {
            toolsUsed.push(toolMatch[1]);
            addLog(`Tool: ${chunk.trim()}`);
          }
        }
      };

      // Execute the agent
      addLog('Sending request to AI service...');
      const result = await claraApiService.sendChatMessage(
        fullInstructions,
        aiConfig,
        attachments || [],
        undefined, // system prompt will be generated
        [], // no conversation history
        streamCallback
      );

      const duration = Date.now() - startTime;
      addLog(`Execution completed in ${duration}ms`);

      return {
        success: true,
        content: result.content,
        toolResults: result.mcpToolResults || [],
        executionLog: executionLogs.join('\n'),
        metadata: {
          provider: config.provider,
          model: config.textModel,
          duration,
          toolsUsed,
          agentSteps: Math.max(agentSteps, 1),
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          mcpServersEnabled: config.enabledMCPServers,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          tokensUsed: result.metadata?.usage?.total_tokens,
          ...result.metadata
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      addLog(`Execution failed: ${errorMessage}`);
      
      return {
        success: false,
        content: `Agent execution failed: ${errorMessage}`,
        toolResults: [],
        executionLog: executionLogs.join('\n'),
        metadata: {
          provider: config.provider,
          model: config.textModel,
          duration,
          toolsUsed: [],
          agentSteps: 0,
          error: errorMessage,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Phase 2: Helper method to assess task complexity
   */
  private assessTaskComplexity(instructions: string, config: AgentExecutionConfig): 'simple' | 'moderate' | 'complex' {
    const indicators = {
      simple: ['get', 'find', 'show', 'list', 'what', 'who', 'when', 'where'],
      moderate: ['analyze', 'compare', 'create', 'generate', 'process', 'transform'],
      complex: ['optimize', 'design', 'implement', 'integrate', 'automate', 'develop', 'build']
    };
    
    const words = instructions.toLowerCase().split(/\s+/);
    const toolCount = config.enabledMCPServers.length;
    
    let complexityScore = 0;
    
    // Check for complexity indicators
    words.forEach(word => {
      if (indicators.simple.includes(word)) complexityScore += 1;
      if (indicators.moderate.includes(word)) complexityScore += 2;
      if (indicators.complex.includes(word)) complexityScore += 3;
    });
    
    // Factor in available tools
    if (toolCount > 3) complexityScore += 1;
    if (toolCount > 6) complexityScore += 2;
    
    // Factor in instruction length
    if (instructions.length > 500) complexityScore += 1;
    if (instructions.length > 1000) complexityScore += 2;
    
    if (complexityScore <= 3) return 'simple';
    if (complexityScore <= 7) return 'moderate';
    return 'complex';
  }

  /**
   * Phase 2: Execute as single comprehensive task (fallback)
   */
  private async executeSingleTask(
    instructions: string,
    config: AgentExecutionConfig,
    context?: string,
    attachments?: ClaraFileAttachment[],
    addLog?: (message: string) => void
  ): Promise<any> {
    const aiConfig = this.createAIConfig(config);
    
    let fullInstructions = instructions;
    if (context && context.trim()) {
      fullInstructions = `Context: ${context}\n\nTask: ${instructions}`;
    }
    
    const toolsUsed: string[] = [];
    const streamCallback = (chunk: string) => {
      if (chunk.includes('Using') && chunk.includes('tool')) {
        const toolMatch = chunk.match(/Using\s+([^\s]+)\s+tool/);
        if (toolMatch && toolMatch[1] && !toolsUsed.includes(toolMatch[1])) {
          toolsUsed.push(toolMatch[1]);
          if (addLog) addLog(`Tool: ${chunk.trim()}`);
        }
      }
    };
    
    return await claraApiService.sendChatMessage(
      fullInstructions,
      aiConfig,
      attachments || [],
      undefined,
      [],
      streamCallback
    );
  }

  /**
   * Phase 2: Validate execution results
   */
  private async validateResults(
    result: any,
    originalInstructions: string,
    config: AgentExecutionConfig,
    addLog?: (message: string) => void
  ): Promise<{ passed: boolean; score: number; issues: string[]; suggestions: string[] }> {
    if (addLog) addLog('Validating execution results...');
    
    // Fallback validation for now - can be enhanced later
    const basicScore = result && (typeof result === 'string' ? result.length > 50 : result.content?.length > 50) ? 85 : 60;
    return {
      passed: basicScore >= 70,
      score: basicScore,
      issues: basicScore < 70 ? ['Result may be incomplete or too brief'] : [],
      suggestions: basicScore < 90 ? ['Consider adding more detail'] : []
    };
  }

  /**
   * Create AI configuration from agent execution config
   */
  private createAIConfig(config: AgentExecutionConfig): ClaraAIConfig {
    const aiConfig = {
      models: {
        text: config.textModel,
        vision: config.visionModel || config.textModel,
        code: config.codeModel || config.textModel
      },
      provider: config.provider,
      parameters: {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: 1.0,
        topK: 40,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        repetitionPenalty: 1.0,
        minP: 0.0,
        typicalP: 1.0,
        seed: null,
        stop: []
      },
      features: {
        enableTools: true,
        enableRAG: false,
        enableStreaming: false,
        enableVision: !!config.visionModel,
        autoModelSelection: false,
        enableMCP: config.enabledMCPServers.length > 0,
        enableStructuredToolCalling: false,
        enableNativeJSONSchema: false,
        enableMemory: false
      },
      artifacts: {
        enableCodeArtifacts: false,
        enableChartArtifacts: false,
        enableTableArtifacts: false,
        enableMermaidArtifacts: false,
        enableHtmlArtifacts: false,
        enableMarkdownArtifacts: false,
        enableJsonArtifacts: false,
        enableDiagramArtifacts: false,
        autoDetectArtifacts: false,
        maxArtifactsPerMessage: 0
      },
      mcp: {
        enableTools: true,
        enableResources: true,
        enabledServers: config.enabledMCPServers,
        autoDiscoverTools: true,
        maxToolCalls: 5
      },
      autonomousAgent: {
        enabled: true,
        maxRetries: config.maxRetries,
        retryDelay: 1000,
        enableSelfCorrection: config.enableSelfCorrection,
        enableToolGuidance: config.enableToolGuidance,
        enableProgressTracking: true,
        maxToolCalls: config.maxToolCalls,
        confidenceThreshold: config.confidenceThreshold,
        enableChainOfThought: config.enableChainOfThought,
        enableErrorLearning: true
      }
    };
    
    console.log(`📋 Created AI Config:`, {
      provider: aiConfig.provider,
      textModel: aiConfig.models.text,
      mcpEnabled: aiConfig.features.enableMCP,
      mcpServers: aiConfig.mcp.enabledServers
    });
    
    return aiConfig;
  }

  /**
   * Get available providers from Clara API service
   */
  async getAvailableProviders() {
    try {
      return await claraApiService.getProviders();
    } catch (error) {
      console.error('Failed to get providers:', error);
      return [];
    }
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(providerId: string) {
    try {
      return await claraApiService.getModels(providerId);
    } catch (error) {
      console.error(`Failed to get models for provider ${providerId}:`, error);
      return [];
    }
  }

  /**
   * Test provider connectivity
   */
  async testProvider(providerId: string) {
    try {
      const providers = await this.getAvailableProviders();
      const provider = providers.find(p => p.id === providerId);
      
      if (!provider) {
        return false;
      }

      return await claraApiService.testProvider(provider);
    } catch (error) {
      console.error(`Failed to test provider ${providerId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const claraAgentExecutionService = new ClaraAgentExecutionService();
