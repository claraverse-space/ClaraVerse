/**
 * Clara Assistant API Service
 * 
 * This service handles all API communications for the Clara Assistant,
 * using the existing AssistantAPIClient that talks directly to AI providers
 * with OpenAI-like APIs.
 */

import { AssistantAPIClient } from '../utils/AssistantAPIClient';
import type { ChatMessage } from '../utils/APIClient';
import { 
  ClaraMessage, 
  ClaraFileAttachment, 
  ClaraProvider, 
  ClaraModel, 
  ClaraAIConfig,
  ClaraArtifact,
  ClaraProviderType,
  ClaraMCPToolCall,
  ClaraMCPToolResult
} from '../types/clara_assistant_types';
import { defaultTools, executeTool } from '../utils/claraTools';
import { db } from '../db';
import type { Tool } from '../db';
import { claraMCPService } from './claraMCPService';
import { claraMemoryService } from './claraMemoryService';
import { addCompletionNotification, addErrorNotification, addInfoNotification } from './notificationService';
import { TokenLimitRecoveryService } from './tokenLimitRecoveryService';
import { ToolSuccessRegistry } from './toolSuccessRegistry';

/**
 * Chat request payload for Clara backend
 */
interface ClaraChatRequest {
  query: string;
  collection_name?: string;
  system_template?: string;
  k?: number;
  filter?: Record<string, any>;
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  enable_tools?: boolean;
  enable_rag?: boolean;
}

/**
 * Chat response from Clara backend
 */
interface ClaraChatResponse {
  response: string;
  model?: string;
  tokens?: number;
  processing_time?: number;
  tool_calls?: any[];
  artifacts?: any[];
  error?: string;
}

/**
 * File upload response from Clara backend
 */
interface ClaraFileUploadResponse {
  document_id: number;
  filename: string;
  file_type: string;
  collection_name: string;
  processed: boolean;
  processing_result?: any;
  error?: string;
}

/**
 * Simple autonomous agent configuration
 */
interface AutonomousConfig {
  maxIterations: number;
  enableToolChaining: boolean;
  enableProgressTracking: boolean;
}

/**
 * Agent iteration result
 */
interface AgentIteration {
  step: number;
  response: string;
  toolCalls: any[];
  toolResults: any[];
  hasMoreWork: boolean;
}

export class ClaraApiService {
  private client: AssistantAPIClient | null = null;
  private currentProvider: ClaraProvider | null = null;
  private recoveryService: TokenLimitRecoveryService;
  private stopExecution: boolean = false;

  constructor() {
    // Initialize the recovery service
    this.recoveryService = TokenLimitRecoveryService.getInstance();
    this.initializeFromConfig();
  }

  /**
   * Initialize API service from database configuration
   */
  private async initializeFromConfig() {
    try {
      const primaryProvider = await this.getPrimaryProvider();
      if (primaryProvider) {
        this.updateProvider(primaryProvider);
      }
    } catch (error) {
      console.warn('Failed to load primary provider:', error);
    }
  }

  /**
   * Update API client for a specific provider
   */
  public updateProvider(provider: ClaraProvider) {
    this.currentProvider = provider;
    this.client = new AssistantAPIClient(provider.baseUrl || '', {
      apiKey: provider.apiKey || '',
      providerId: provider.id // Pass provider ID for tool error tracking
    });
  }

  /**
   * Get available providers from database
   */
  public async getProviders(): Promise<ClaraProvider[]> {
    try {
      const dbProviders = await db.getAllProviders();
      
      // Convert DB providers to Clara providers
      const claraProviders: ClaraProvider[] = dbProviders.map(provider => ({
        id: provider.id,
        name: provider.name,
        type: provider.type as ClaraProviderType,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        isEnabled: provider.isEnabled,
        isPrimary: provider.isPrimary,
        config: provider.config
      }));

      return claraProviders;
    } catch (error) {
      console.error('Failed to get providers:', error);
      return [];
    }
  }

  /**
   * Get available models from all providers or a specific provider
   */
  public async getModels(providerId?: string): Promise<ClaraModel[]> {
    const models: ClaraModel[] = [];
    const providers = await this.getProviders();
    
    // Filter providers based on providerId parameter
    const targetProviders = providerId 
      ? providers.filter(p => p.id === providerId && p.isEnabled)
      : providers.filter(p => p.isEnabled);

    for (const provider of targetProviders) {
      try {
        // Create temporary client for this provider
        const tempClient = new AssistantAPIClient(provider.baseUrl || '', {
          apiKey: provider.apiKey || '',
          providerId: provider.id // Pass provider ID for tool error tracking
        });
        
        const providerModels = await tempClient.listModels();
        
        for (const model of providerModels) {
          const claraModel: ClaraModel = {
            id: `${provider.id}:${model.id}`,
            name: model.name || model.id,
            provider: provider.id,
            type: this.detectModelType(model.name || model.id),
            size: model.size,
            supportsVision: this.supportsVision(model.name || model.id),
            supportsCode: this.supportsCode(model.name || model.id),
            supportsTools: this.supportsTools(model.name || model.id),
            metadata: {
              digest: model.digest,
              modified_at: model.modified_at
            }
          };
          
          models.push(claraModel);
        }
      } catch (error) {
        console.warn(`Failed to get models from provider ${provider.name}:`, error);
      }
    }

    return models;
  }

  /**
   * Get models from the currently selected provider only
   */
  public async getCurrentProviderModels(): Promise<ClaraModel[]> {
    if (!this.currentProvider) {
      return [];
    }
    
    return this.getModels(this.currentProvider.id);
  }

  /**
   * Send a chat message
   */
  public async sendChatMessage(
    message: string,
    config: ClaraAIConfig,
    attachments?: ClaraFileAttachment[],
    systemPrompt?: string,
    conversationHistory?: ClaraMessage[],
    onContentChunk?: (content: string) => void
  ): Promise<ClaraMessage> {
    if (!this.client) {
      throw new Error('No API client configured. Please select a provider.');
    }

    // Switch to the provider specified in config if different from current
    if (config.provider && (!this.currentProvider || this.currentProvider.id !== config.provider)) {
      console.log(`🔄 Switching provider from ${this.currentProvider?.id || 'none'} to ${config.provider}`);
      try {
        const providers = await this.getProviders();
        const requestedProvider = providers.find(p => p.id === config.provider);
        
        if (requestedProvider) {
          console.log(`✅ Found provider ${config.provider}:`, {
            name: requestedProvider.name,
            baseUrl: requestedProvider.baseUrl,
            isEnabled: requestedProvider.isEnabled
          });
          
          if (!requestedProvider.isEnabled) {
            throw new Error(`Provider ${requestedProvider.name} is not enabled`);
          }
          
          // Update the client to use the requested provider
          this.updateProvider(requestedProvider);
          console.log(`🚀 Switched to provider: ${requestedProvider.name} (${requestedProvider.baseUrl})`);
        } else {
          throw new Error(`Provider ${config.provider} not found or not configured`);
        }
      } catch (error) {
        console.error(`❌ Failed to switch to provider ${config.provider}:`, error);
        throw new Error(`Failed to switch to provider ${config.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (config.provider) {
      console.log(`✅ Already using correct provider: ${this.currentProvider?.name} (${this.currentProvider?.baseUrl})`);
    }

    try {
      // Process file attachments if any
      const processedAttachments = await this.processFileAttachments(attachments || []);

      // Determine the appropriate model based on context and auto selection settings
      let modelId = this.selectAppropriateModel(config, message, processedAttachments, conversationHistory);
      
      // If the model ID includes the provider prefix (e.g., "ollama:qwen3:30b"), 
      // extract everything after the first colon to get the actual model name
      if (modelId.includes(':')) {
        const parts = modelId.split(':');
        // Remove the provider part (first element) and rejoin the rest
        const originalModelId = modelId;
        modelId = parts.slice(1).join(':');
        console.log(`Model ID extraction: "${originalModelId}" -> "${modelId}"`);
      }

      // Get tools if enabled
      let tools: Tool[] = [];
      if (config.features.enableTools) {
        const dbTools = await db.getEnabledTools();
        tools = dbTools;
        
        // Add MCP tools if enabled
        if (config.features.enableMCP && config.mcp?.enableTools) {
          console.log('🔧 MCP is enabled, attempting to add MCP tools...');
          try {
            // Ensure MCP service is ready
            if (claraMCPService.isReady()) {
              console.log('✅ MCP service is ready');
              
              // Get enabled servers from config
              const enabledServers = config.mcp.enabledServers || [];
              console.log('📋 Enabled MCP servers from config:', enabledServers);
              
              if (enabledServers.length === 0) {
                console.log('🚫 No MCP servers explicitly enabled - skipping MCP tools');
                if (onContentChunk) {
                  onContentChunk('ℹ️ **No MCP servers selected** - Please enable specific MCP servers in configuration to use MCP tools.\n\n');
                }
              } else {
                // Check server availability and provide feedback
                const serverSummary = claraMCPService.getServerAvailabilitySummary(enabledServers);
                console.log('🔍 Server availability summary:', serverSummary);
                
                // Provide UI feedback about server status
                if (onContentChunk && serverSummary.unavailable.length > 0) {
                  let feedbackMessage = '\n🔧 **MCP Server Status:**\n';
                  
                  if (serverSummary.available.length > 0) {
                    feedbackMessage += `✅ Available: ${serverSummary.available.join(', ')} (${serverSummary.totalTools} tools)\n`;
                  }
                  
                  if (serverSummary.unavailable.length > 0) {
                    feedbackMessage += '❌ Unavailable servers:\n';
                    for (const unavailable of serverSummary.unavailable) {
                      feedbackMessage += `   • ${unavailable.server}: ${unavailable.reason}\n`;
                    }
                  }
                  
                  feedbackMessage += '\n';
                  onContentChunk(feedbackMessage);
                }
                
                // Get tools only from explicitly enabled servers
                const mcpTools = claraMCPService.getToolsFromEnabledServers(enabledServers);
                console.log(`🛠️ Found ${mcpTools.length} MCP tools from enabled servers:`, mcpTools.map(t => `${t.server}:${t.name}`));
                
                if (mcpTools.length === 0) {
                  console.warn('⚠️ No MCP tools available from enabled/running servers');
                  if (onContentChunk) {
                    onContentChunk('⚠️ **No MCP tools available** - all configured servers are offline or disabled.\n\n');
                  }
                } else {
                  // Convert only the filtered tools to OpenAI format
                  const mcpOpenAITools = claraMCPService.convertSpecificToolsToOpenAIFormat(mcpTools);
                  console.log(`🔄 Converted and validated ${mcpOpenAITools.length} OpenAI format tools`);
                  
                  // Convert to Tool format for compatibility
                  const mcpToolsFormatted: Tool[] = mcpOpenAITools.map(tool => ({
                    id: tool.function.name,
                    name: tool.function.name,
                    description: tool.function.description,
                    parameters: Object.entries(tool.function.parameters.properties || {}).map(([name, prop]: [string, any]) => ({
                      name,
                      type: prop.type || 'string',
                      description: prop.description || '',
                      required: tool.function.parameters.required?.includes(name) || false
                    })),
                    implementation: 'mcp', // Mark as MCP tool for special handling
                    isEnabled: true
                  }));
                  
                  const beforeCount = tools.length;
                  tools = [...tools, ...mcpToolsFormatted];
                  console.log(`📈 Added ${mcpToolsFormatted.length} MCP tools to existing ${beforeCount} tools (total: ${tools.length})`);
                  
                  // Provide UI feedback about loaded tools
                  if (onContentChunk && mcpToolsFormatted.length > 0) {
                    const toolsByServer = mcpToolsFormatted.reduce((acc, tool) => {
                      const serverName = tool.name.split('_')[1]; // Extract server name from mcp_server_tool format
                      acc[serverName] = (acc[serverName] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                    
                    let toolsMessage = `🛠️ **Loaded ${mcpToolsFormatted.length} MCP tools:**\n`;
                    for (const [server, count] of Object.entries(toolsByServer)) {
                      toolsMessage += `   • ${server}: ${count} tools\n`;
                    }
                    toolsMessage += '\n';
                    onContentChunk(toolsMessage);
                  }
                }
              }
            } else {
              console.warn('⚠️ MCP service not ready, skipping MCP tools');
              if (onContentChunk) {
                onContentChunk('⚠️ **MCP service not ready** - skipping MCP tools. Please check your MCP configuration.\n\n');
              }
            }
          } catch (error) {
            console.error('❌ Error adding MCP tools:', error);
            if (onContentChunk) {
              onContentChunk(`❌ **Error loading MCP tools:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n`);
            }
          }
        } else {
          console.log('🚫 MCP tools disabled:', {
            enableMCP: config.features.enableMCP,
            enableTools: config.mcp?.enableTools
          });
          if (onContentChunk && config.features.enableMCP === false) {
            onContentChunk('ℹ️ **MCP tools disabled** in configuration.\n\n');
          }
        }
      }

      // Check if autonomous agent mode is enabled
      const isAutonomousMode = config.autonomousAgent?.enabled !== false;
      
      if (isAutonomousMode) {
        console.log(`🤖 Autonomous agent mode enabled - using new agent system`);
        
        // Add notification for autonomous mode start
        addInfoNotification(
          'Autonomous Mode Activated',
          'Clara is now operating in autonomous mode.',
          3000
        );
        
        // Execute autonomous agent workflow
        const result = await this.executeAutonomousAgent(
          modelId, 
          message,
          tools, 
          config,
          processedAttachments,
          systemPrompt,
          conversationHistory,
          onContentChunk
        );

        // Add completion notification for autonomous mode
        const toolsUsed = result.metadata?.toolsUsed || [];
        const agentSteps = result.metadata?.agentSteps || 1;
        
        addCompletionNotification(
          'Autonomous Agent Complete',
          `Completed in ${agentSteps} steps${toolsUsed.length > 0 ? ` using ${toolsUsed.length} tools` : ''}.`,
          5000
        );

        return result;
      }

      // Execute standard chat workflow
      const result = await this.executeStandardChat(
        modelId, 
        message,
        tools, 
        config,
        processedAttachments,
        systemPrompt,
        conversationHistory,
        onContentChunk
      );

      return result;

    } catch (error) {
      console.error('Chat execution failed:', error);
      
      // Check if this is an abort error (user stopped the stream)
      const isAbortError = error instanceof Error && (
        error.message.includes('aborted') ||
        error.message.includes('BodyStreamBuffer was aborted') ||
        error.message.includes('AbortError') ||
        error.name === 'AbortError'
      );
      
      if (isAbortError) {
        console.log('Stream was aborted by user, returning partial content');
        
        return {
          id: `${Date.now()}-aborted`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          metadata: {
            model: `${config.provider}:${config.models.text || 'unknown'}`,
            temperature: config.parameters.temperature,
            aborted: true,
            error: 'Stream was stopped by user'
          }
        };
      }
      
      // Return error message only for actual errors (not user aborts)
      return {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * NEW: Execute autonomous agent workflow
   */
  private async executeAutonomousAgent(
    modelId: string,
    message: string,
    tools: Tool[],
    config: ClaraAIConfig,
    attachments: ClaraFileAttachment[],
    systemPrompt?: string,
    conversationHistory?: ClaraMessage[],
    onContentChunk?: (content: string) => void
  ): Promise<ClaraMessage> {
    // Reset stop flag
    this.stopExecution = false;
    
    // Start memory session for this autonomous execution
    const sessionId = `autonomous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    claraMemoryService.startSession(sessionId, 'autonomous-agent');
    
    // Default autonomous configuration
    const autonomousConfig: AutonomousConfig = {
      maxIterations: config.autonomousAgent?.maxToolCalls || 5,
      enableToolChaining: config.autonomousAgent?.enableToolGuidance !== false,
      enableProgressTracking: config.autonomousAgent?.enableProgressTracking !== false
    };

    console.log(`🤖 Starting autonomous agent with config:`, autonomousConfig);

    // Build enhanced system prompt for autonomous mode
    const enhancedSystemPrompt = this.buildAutonomousSystemPrompt(systemPrompt, tools, autonomousConfig);

    // Build conversation messages
    const messages: ChatMessage[] = [];
    
    // Add enhanced system prompt
    messages.push({
      role: 'system',
      content: enhancedSystemPrompt
    });

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      const historyMessages = conversationHistory.slice(0, -1);
      for (const historyMessage of historyMessages) {
        const chatMessage: ChatMessage = {
          role: historyMessage.role,
          content: historyMessage.content
        };

        if (historyMessage.attachments) {
          const imageAttachments = historyMessage.attachments.filter(att => att.type === 'image');
          if (imageAttachments.length > 0) {
            chatMessage.images = imageAttachments.map(att => att.base64 || att.url || '');
          }
        }

        messages.push(chatMessage);
      }
    }

    // Add the current user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message
    };

    // Add images if any attachments are images
    const imageAttachments = attachments.filter(att => att.type === 'image');
    if (imageAttachments.length > 0) {
      userMessage.images = imageAttachments.map(att => att.base64 || att.url || '');
    }

    messages.push(userMessage);

    // Track execution state
    let totalTokens = 0;
    let allToolResults: any[] = [];
    let finalResponse = '';
    let currentMessages = [...messages];

    // Progress tracking
    if (autonomousConfig.enableProgressTracking && onContentChunk) {
      onContentChunk('🤖 **Autonomous agent started**\n\n');
    }

    try {
      // Main autonomous loop
      for (let iteration = 0; iteration < autonomousConfig.maxIterations; iteration++) {
        // Check for stop signal
        if (this.stopExecution) {
          console.log(`🛑 Autonomous execution stopped at iteration ${iteration + 1}`);
          if (onContentChunk) {
            onContentChunk(`\n🛑 **Execution stopped by user**\n\n`);
          }
          break;
        }

        console.log(`🔄 Autonomous iteration ${iteration + 1}/${autonomousConfig.maxIterations}`);
        
        if (autonomousConfig.enableProgressTracking && onContentChunk && iteration > 0) {
          onContentChunk(`\n**Step ${iteration + 1}:**\n`);
        }

        try {
          // Execute single iteration
          const iterationResult = await this.executeAgentIteration(
            modelId,
            currentMessages,
            tools,
            config,
            iteration + 1,
            onContentChunk
          );

          // Store tool results in memory
          for (const toolResult of iterationResult.toolResults) {
            claraMemoryService.storeToolResult({
              toolName: toolResult.toolName,
              success: toolResult.success,
              result: toolResult.result,
              error: toolResult.error,
              metadata: toolResult.metadata
            });
          }

          // Add iteration response to final output
          finalResponse += iterationResult.response;
          totalTokens += iterationResult.toolResults.length * 10; // Rough estimate
          allToolResults.push(...iterationResult.toolResults);

          // Add assistant response to conversation
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: iterationResult.response,
            tool_calls: iterationResult.toolCalls
          };
          currentMessages.push(assistantMessage);

          // Add tool results to conversation
          for (const toolCall of iterationResult.toolCalls) {
            const toolResult = iterationResult.toolResults.find(r => r.toolName === toolCall.function?.name);
            if (toolResult) {
              let content: string;
              if (toolResult.success && toolResult.result !== undefined && toolResult.result !== null) {
                content = typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result);
              } else {
                content = toolResult.error || `Tool ${toolResult.toolName} execution failed`;
              }
              
              currentMessages.push({
                role: 'tool',
                content: content,
                name: toolResult.toolName,
                tool_call_id: toolCall.id
              });
            }
          }

          // Check if we should continue
          if (!iterationResult.hasMoreWork) {
            console.log(`✅ Autonomous agent completed at iteration ${iteration + 1}`);
            if (autonomousConfig.enableProgressTracking && onContentChunk) {
              onContentChunk(`\n✅ **Task completed**\n\n`);
            }
            break;
          }

        } catch (error) {
          console.error(`❌ Autonomous iteration ${iteration + 1} failed:`, error);
          if (onContentChunk) {
            onContentChunk(`\n❌ **Error in step ${iteration + 1}**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`);
          }
          break;
        }
      }

      // Generate memory context for final response
      const memoryContext = claraMemoryService.generateMemoryContext();
      
      // If we have memory context, append it to the final response
      if (memoryContext) {
        console.log('🧠 Appending memory context to final response');
        finalResponse += memoryContext;
      }

      // Create final Clara message
      const claraMessage: ClaraMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: finalResponse || 'I completed the autonomous agent execution.',
        timestamp: new Date(),
        metadata: {
          model: `${config.provider}:${modelId}`,
          tokens: totalTokens,
          temperature: config.parameters.temperature,
          toolsUsed: allToolResults.map(tc => tc.toolName),
          agentSteps: Math.min(autonomousConfig.maxIterations, allToolResults.length / 2 + 1),
          autonomousMode: true,
          memorySessionId: sessionId
        }
      };

      // Add artifacts if any were generated from tool calls
      if (allToolResults.length > 0) {
        claraMessage.artifacts = this.parseToolResultsToArtifacts(allToolResults);
      }

      return claraMessage;

    } finally {
      // Clear memory session after completion
      claraMemoryService.clearCurrentSession();
      console.log('🧠 Memory session cleared after autonomous execution');
    }
  }

  /**
   * Execute a single autonomous agent iteration
   */
  private async executeAgentIteration(
    modelId: string,
    messages: ChatMessage[],
    tools: Tool[],
    config: ClaraAIConfig,
    stepNumber: number,
    onContentChunk?: (content: string) => void
  ): Promise<AgentIteration> {
    const options = {
      temperature: config.parameters.temperature,
      max_tokens: config.parameters.maxTokens,
      top_p: config.parameters.topP
    };

    let response = '';
    let toolCalls: any[] = [];
    let toolResults: any[] = [];

    try {
      // Make API call - use non-streaming for autonomous mode to avoid complexity
      const apiResponse = await this.client!.sendChat(modelId, messages, options, tools);
      response = apiResponse.message?.content || '';
      
      if (onContentChunk && response) {
        onContentChunk(response);
      }

      // Handle tool calls if any
      if (apiResponse.message?.tool_calls && apiResponse.message.tool_calls.length > 0) {
        toolCalls = apiResponse.message.tool_calls;
        
        if (onContentChunk) {
          onContentChunk(`\n🔧 **Executing tools...**\n`);
        }

        // Execute tools
        toolResults = await this.executeToolCalls(toolCalls);

        if (onContentChunk) {
          const successCount = toolResults.filter(r => r.success).length;
          const failCount = toolResults.filter(r => !r.success).length;
          if (failCount === 0) {
            onContentChunk(`✅ **Tools completed successfully**\n\n`);
          } else {
            onContentChunk(`✅ **Tools completed** (${successCount} successful, ${failCount} failed)\n\n`);
          }
        }
      }

      // Determine if there's more work to do
      const hasMoreWork = toolCalls.length > 0 && stepNumber < 5; // Simple heuristic

      return {
        step: stepNumber,
        response,
        toolCalls,
        toolResults,
        hasMoreWork
      };

    } catch (error) {
      console.error(`❌ Agent iteration ${stepNumber} failed:`, error);
      return {
        step: stepNumber,
        response: response || `Error in step ${stepNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolCalls: [],
        toolResults: [],
        hasMoreWork: false
      };
    }
  }

  /**
   * Build enhanced system prompt for autonomous mode
   */
  private buildAutonomousSystemPrompt(
    originalPrompt: string | undefined,
    tools: Tool[],
    config: AutonomousConfig
  ): string {
    const toolsList = tools.map(tool => {
      const requiredParams = tool.parameters.filter(p => p.required).map(p => p.name);
      return `- ${tool.name}: ${tool.description}${requiredParams.length > 0 ? ` (Required: ${requiredParams.join(', ')})` : ''}`;
    }).join('\n');

    return `${originalPrompt || 'You are Clara, a helpful AI assistant.'}

🤖 **AUTONOMOUS AGENT MODE**

You are now operating as an autonomous agent. Your capabilities:

**AVAILABLE TOOLS:**
${toolsList || 'No tools available'}

**AUTONOMOUS BEHAVIOR:**
- You can use tools to accomplish tasks
- Chain tool results together when logical
- Provide clear explanations of your actions
- Work towards completing the user's request
- If you encounter errors, try alternative approaches

**RESPONSE GUIDELINES:**
- Be clear about what you're doing
- Explain tool usage and results
- Provide helpful information to the user
- Complete tasks efficiently

Work autonomously to fulfill the user's request using the available tools.`;
  }

  /**
   * Process file attachments by analyzing them locally
   */
  private async processFileAttachments(attachments: ClaraFileAttachment[]): Promise<ClaraFileAttachment[]> {
    const processed = [...attachments];

    for (const attachment of processed) {
      try {
        // For images, we already have base64 or URL - mark as processed
        if (attachment.type === 'image') {
          attachment.processed = true;
          attachment.processingResult = {
            success: true,
            metadata: {
              type: 'image',
              processedAt: new Date().toISOString()
            }
          };
        }

        // For PDFs and documents, we could add text extraction here
        // For now, mark as processed but note that extraction isn't implemented
        if (attachment.type === 'pdf' || attachment.type === 'document') {
          attachment.processed = true;
          attachment.processingResult = {
            success: true,
            extractedText: 'Text extraction not yet implemented in client-side processing.',
            metadata: {
              type: attachment.type,
              processedAt: new Date().toISOString(),
              note: 'Full document processing requires backend integration'
            }
          };
        }

        // For code files, we can analyze the structure
        if (attachment.type === 'code') {
          attachment.processed = true;
          attachment.processingResult = {
            success: true,
            codeAnalysis: {
              language: this.detectCodeLanguage(attachment.name),
              structure: {
                functions: [],
                classes: [],
                imports: []
              },
              metrics: {
                lines: 0,
                complexity: 0
              }
            },
            metadata: {
              type: 'code',
              processedAt: new Date().toISOString()
            }
          };
        }

      } catch (error) {
        attachment.processed = false;
        attachment.processingResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        };
      }
    }

    return processed;
  }

  /**
   * Execute standard chat workflow
   */
  private async executeStandardChat(
    modelId: string,
    message: string,
    tools: Tool[],
    config: ClaraAIConfig,
    attachments: ClaraFileAttachment[],
    systemPrompt?: string,
    conversationHistory?: ClaraMessage[],
    onContentChunk?: (content: string) => void
  ): Promise<ClaraMessage> {
    const options = {
      temperature: config.parameters.temperature,
      max_tokens: config.parameters.maxTokens,
      top_p: config.parameters.topP
    };

    let responseContent = '';
    let totalTokens = 0;
    let toolResults: any[] = [];
    let finalUsage: any = {};
    let finalTimings: any = {};

    // Build conversation messages
    const messages: ChatMessage[] = [];
    
    // Add system prompt
    messages.push({
      role: 'system',
      content: systemPrompt || 'You are Clara, a helpful AI assistant.'
    });

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      // Convert Clara messages to ChatMessage format, excluding the last message since it's the current one
      const historyMessages = conversationHistory.slice(0, -1);
      for (const historyMessage of historyMessages) {
        const chatMessage: ChatMessage = {
          role: historyMessage.role,
          content: historyMessage.content
        };

        // Add images if the message has image attachments
        if (historyMessage.attachments) {
          const imageAttachments = historyMessage.attachments.filter(att => att.type === 'image');
          if (imageAttachments.length > 0) {
            chatMessage.images = imageAttachments.map(att => att.base64 || att.url || '');
          }
        }

        messages.push(chatMessage);
      }
      console.log(`📚 Added ${conversationHistory.length - 1} history messages to chat context`);
    }

    // Add the current user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message
    };

    // Add images if any attachments are images
    const imageAttachments = attachments.filter(att => att.type === 'image');
    if (imageAttachments.length > 0) {
      userMessage.images = imageAttachments.map(att => att.base64 || att.url || '');
    }

    messages.push(userMessage);

    console.log(`💬 Starting chat execution with ${messages.length} messages and ${tools.length} tools`);

    try {
      let response;

      // Try streaming first if enabled
      if (config.features.enableStreaming) {
        // Check if we should disable streaming for this provider when tools are present
        const shouldDisableStreamingForTools = this.shouldDisableStreamingForTools(tools);
        
        if (shouldDisableStreamingForTools) {
          console.log(`🔄 Disabling streaming for ${this.currentProvider?.type} provider with tools present`);
          if (onContentChunk) {
            onContentChunk('⚠️ Switching to non-streaming mode for better tool support with this provider...\n\n');
          }
          // Use non-streaming mode
          response = await this.client!.sendChat(modelId, messages, options, tools);
          responseContent = response.message?.content || '';
          totalTokens = response.usage?.total_tokens || 0;
          finalUsage = response.usage || {};
          finalTimings = response.timings || {};
          
          if (onContentChunk && responseContent) {
            onContentChunk(responseContent);
          }
        } else {
          // Use streaming mode
          try {
            const collectedToolCalls: any[] = [];
            let streamContent = '';

            for await (const chunk of this.client!.streamChat(modelId, messages, options, tools)) {
              if (chunk.message?.content) {
                streamContent += chunk.message.content;
                responseContent += chunk.message.content;
                if (onContentChunk) {
                  onContentChunk(chunk.message.content);
                }
              }

              // Collect tool calls
              if (chunk.message?.tool_calls) {
                for (const toolCall of chunk.message.tool_calls) {
                  if (!toolCall.id && !toolCall.function?.name) {
                    continue;
                  }
                  
                  let existingCall = collectedToolCalls.find(c => c.id === toolCall.id);
                  if (!existingCall) {
                    existingCall = {
                      id: toolCall.id || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      type: toolCall.type || 'function',
                      function: { name: '', arguments: '' }
                    };
                    collectedToolCalls.push(existingCall);
                  }
                  
                  if (toolCall.function?.name) {
                    existingCall.function.name = toolCall.function.name;
                  }
                  
                  if (toolCall.function?.arguments) {
                    existingCall.function.arguments += toolCall.function.arguments;
                  }
                }
              }

              if (chunk.usage?.total_tokens) {
                totalTokens = chunk.usage.total_tokens;
                finalUsage = chunk.usage;
              }
              if (chunk.timings) {
                finalTimings = chunk.timings;
              }
            }

            response = {
              message: {
                content: streamContent,
                tool_calls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined
              },
              usage: { total_tokens: totalTokens }
            };

            // Filter out incomplete tool calls
            if (response.message?.tool_calls) {
              response.message.tool_calls = response.message.tool_calls.filter(toolCall => {
                if (!toolCall.function?.name || toolCall.function.name.trim() === '') {
                  return false;
                }
                
                if (typeof toolCall.function.arguments !== 'string') {
                  return false;
                }
                
                try {
                  JSON.parse(toolCall.function.arguments || '{}');
                  return true;
                } catch (parseError) {
                  return false;
                }
              });
              
              if (response.message.tool_calls.length === 0) {
                response.message.tool_calls = undefined;
              }
            }

          } catch (streamError: any) {
            const errorMessage = streamError.message?.toLowerCase() || '';
            if (errorMessage.includes('stream') && errorMessage.includes('tool') && tools.length > 0) {
              if (onContentChunk) {
                onContentChunk('\n⚠️ Switching to non-streaming mode for tool support...\n\n');
              }
              response = await this.client!.sendChat(modelId, messages, options, tools);
              responseContent = response.message?.content || '';
              totalTokens = response.usage?.total_tokens || 0;
              finalUsage = response.usage || {};
              finalTimings = response.timings || {};
              
              if (onContentChunk && responseContent) {
                onContentChunk(responseContent);
              }
            } else {
              throw streamError;
            }
          }
        }
      } else {
        // Non-streaming mode
        response = await this.client!.sendChat(modelId, messages, options, tools);
        responseContent = response.message?.content || '';
        totalTokens = response.usage?.total_tokens || 0;
        finalUsage = response.usage || {};
        finalTimings = response.timings || {};
        
        if (onContentChunk && responseContent) {
          onContentChunk(responseContent);
        }
      }

      // Handle tool calls if any
      if (response.message?.tool_calls && response.message.tool_calls.length > 0) {
        if (onContentChunk) {
          onContentChunk('\n\n🔧 **Executing tools...**\n\n');
        }

        toolResults = await this.executeToolCalls(response.message.tool_calls);

        if (onContentChunk) {
          onContentChunk('✅ **Tools executed**\n\n');
        }

        // After tool execution, make a follow-up request to process the results
        if (toolResults.length > 0) {
          const followUpMessages = [...messages];
          
          // Add the assistant's message with tool calls
          followUpMessages.push({
            role: 'assistant',
            content: response.message.content || '',
            tool_calls: response.message.tool_calls
          });
          
          // Add tool results
          for (const toolCall of response.message.tool_calls) {
            const result = toolResults.find(r => r.toolName === toolCall.function?.name);
            
            if (result) {
              let content: string;
              if (result.success && result.result !== undefined && result.result !== null) {
                content = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
              } else {
                content = result.error || `Tool ${result.toolName} execution failed`;
              }
              
              followUpMessages.push({
                role: 'tool',
                content: content,
                name: result.toolName,
                tool_call_id: toolCall.id
              });
            } else {
              followUpMessages.push({
                role: 'tool',
                content: `Tool execution failed: No result returned for ${toolCall.function?.name || 'unknown tool'}`,
                name: toolCall.function?.name || 'unknown_tool',
                tool_call_id: toolCall.id
              });
            }
          }

          // Make follow-up request
          try {
            const followUpResponse = await this.client!.sendChat(modelId, followUpMessages, options);
            const followUpContent = followUpResponse.message?.content || '';
            
            if (followUpContent) {
              responseContent += followUpContent;
              totalTokens += followUpResponse.usage?.total_tokens || 0;
              
              if (onContentChunk) {
                onContentChunk(followUpContent);
              }
            }
          } catch (followUpError) {
            console.error('❌ Follow-up request failed:', followUpError);
            if (onContentChunk) {
              onContentChunk('\n⚠️ Failed to process tool results, but tools were executed successfully.\n');
            }
          }
        }
      }

    } catch (error) {
      console.error('Standard chat execution failed:', error);
      responseContent = 'I apologize, but I encountered an error while processing your request. Please try again.';
    }

    // Create final Clara message
    const claraMessage: ClaraMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: responseContent || 'I apologize, but I was unable to generate a response.',
      timestamp: new Date(),
      metadata: {
        model: `${config.provider}:${modelId}`,
        tokens: totalTokens,
        usage: finalUsage,
        timings: finalTimings,
        temperature: config.parameters.temperature,
        toolsUsed: toolResults.map(tc => tc.toolName),
        autonomousMode: false
      }
    };

    // Add artifacts if any were generated from tool calls
    if (toolResults.length > 0) {
      claraMessage.artifacts = this.parseToolResultsToArtifacts(toolResults);
    }

    return claraMessage;
  }

  /**
   * Execute tool calls using the Clara tools system
   */
  private async executeToolCalls(toolCalls: any[]): Promise<any[]> {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const functionName = toolCall.function?.name;
        
        // Safely parse arguments
        let args = {};
        try {
          if (typeof toolCall.function?.arguments === 'string') {
            const argsString = toolCall.function.arguments.trim();
            if (argsString === '' || argsString === 'null' || argsString === 'undefined') {
              args = {};
            } else {
              args = JSON.parse(argsString);
            }
          } else if (toolCall.function?.arguments && typeof toolCall.function.arguments === 'object') {
            args = toolCall.function.arguments;
          } else {
            args = {};
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse tool arguments for ${functionName}:`, parseError);
          args = {};
        }

        if (!functionName || functionName.trim() === '') {
          console.warn('⚠️ Skipping malformed tool call with empty function name:', toolCall);
          results.push({
            toolName: 'unknown',
            success: false,
            error: 'Tool call has empty or missing function name'
          });
          continue;
        }

        console.log(`🔧 Executing tool: ${functionName} with args:`, args);

        // Check if this is an MCP tool call
        if (functionName?.startsWith('mcp_')) {
          console.log(`🔧 Processing MCP tool call: ${functionName}`);
          try {
            const mcpToolCalls = claraMCPService.parseOpenAIToolCalls([toolCall]);
            
            if (mcpToolCalls.length > 0) {
              const mcpResult = await claraMCPService.executeToolCall(mcpToolCalls[0]);
              
              // Process the MCP result
              const processedResult = this.processMCPToolResult(mcpResult, functionName);
              
              const result = {
                toolName: functionName,
                success: mcpResult.success,
                result: processedResult.result,
                error: mcpResult.error,
                artifacts: processedResult.artifacts,
                images: processedResult.images,
                toolMessage: processedResult.toolMessage,
                metadata: {
                  type: 'mcp',
                  server: mcpToolCalls[0].server,
                  toolName: mcpToolCalls[0].name,
                  ...mcpResult.metadata
                }
              };

              if (result.success) {
                ToolSuccessRegistry.recordSuccess(
                  functionName,
                  'MCP tool',
                  this.currentProvider?.id || 'unknown',
                  toolCall.id
                );
              }
              
              results.push(result);
            } else {
              results.push({
                toolName: functionName,
                success: false,
                error: 'Failed to parse MCP tool call'
              });
            }
          } catch (mcpError) {
            console.error(`❌ MCP tool execution error:`, mcpError);
            results.push({
              toolName: functionName,
              success: false,
              error: mcpError instanceof Error ? mcpError.message : 'MCP tool execution failed'
            });
          }
          continue;
        }

        // Try to execute with Clara tools first
        const claraTool = defaultTools.find(tool => tool.name === functionName || tool.id === functionName);
        
        if (claraTool) {
          const result = await executeTool(claraTool.id, args);
          
          if (result.success) {
            ToolSuccessRegistry.recordSuccess(
              claraTool.name,
              claraTool.description,
              this.currentProvider?.id || 'unknown',
              toolCall.id
            );
          }
          
          results.push({
            toolName: functionName,
            success: result.success,
            result: result.result,
            error: result.error
          });
        } else {
          // Try database tools as fallback
          const dbTools = await db.getEnabledTools();
          const dbTool = dbTools.find(tool => tool.name === functionName);
          
          if (dbTool) {
            try {
              const funcBody = `return (async () => {
                ${dbTool.implementation}
                return await implementation(args);
              })();`;
              const testFunc = new Function('args', funcBody);
              const result = await testFunc(args);
              
              ToolSuccessRegistry.recordSuccess(
                dbTool.name,
                dbTool.description,
                this.currentProvider?.id || 'unknown',
                toolCall.id
              );
              
              results.push({
                toolName: functionName,
                success: true,
                result: result
              });
            } catch (error) {
              results.push({
                toolName: functionName,
                success: false,
                error: error instanceof Error ? error.message : 'Tool execution failed'
              });
            }
          } else {
            results.push({
              toolName: functionName,
              success: false,
              error: `Tool '${functionName}' not found`
            });
          }
        }
      } catch (error) {
        results.push({
          toolName: toolCall.function?.name || 'unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed'
        });
      }
    }

    return results;
  }

  /**
   * Parse tool results into artifacts if appropriate
   */
  private parseToolResultsToArtifacts(toolResults: any[]): ClaraArtifact[] {
    const artifacts: ClaraArtifact[] = [];

    for (const result of toolResults) {
      if (result.success) {
        // Add MCP artifacts if available
        if (result.artifacts && Array.isArray(result.artifacts)) {
          artifacts.push(...result.artifacts);
        }
        
        // Create artifacts for other tool results
        if (result.result && typeof result.result === 'object' && !result.artifacts) {
          artifacts.push({
            id: `tool-result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'json',
            title: `${result.toolName} Result`,
            content: JSON.stringify(result.result, null, 2),
            createdAt: new Date(),
            metadata: {
              toolName: result.toolName,
              toolExecuted: true
            }
          });
        }
      }
    }

    return artifacts;
  }

  /**
   * Process MCP tool results to handle all content types
   */
  private processMCPToolResult(mcpResult: ClaraMCPToolResult, toolName: string): {
    result: any;
    artifacts: ClaraArtifact[];
    images: string[];
    toolMessage: ChatMessage;
  } {
    const artifacts: ClaraArtifact[] = [];
    const images: string[] = [];
    let textContent = '';
    let structuredResult: any = {};

    if (mcpResult.success && mcpResult.content) {
      for (let i = 0; i < mcpResult.content.length; i++) {
        const contentItem = mcpResult.content[i];
        
        switch (contentItem.type) {
          case 'text':
            if (contentItem.text) {
              textContent += (textContent ? '\n\n' : '') + contentItem.text;
              structuredResult.text = contentItem.text;
            }
            break;
            
          case 'image':
            if (contentItem.data && contentItem.mimeType) {
              const imageData = contentItem.data.startsWith('data:') 
                ? contentItem.data 
                : `data:${contentItem.mimeType};base64,${contentItem.data}`;
              images.push(imageData);
              
              artifacts.push({
                id: `mcp-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'json',
                title: `${toolName} - Image Result`,
                content: JSON.stringify({
                  type: 'image',
                  mimeType: contentItem.mimeType,
                  data: imageData,
                  description: `Image generated by ${toolName}`
                }, null, 2),
                createdAt: new Date(),
                metadata: {
                  toolName,
                  mimeType: contentItem.mimeType,
                  source: 'mcp',
                  contentIndex: i,
                  originalType: 'image'
                }
              });
              
              if (!structuredResult.images) structuredResult.images = [];
              structuredResult.images.push({
                mimeType: contentItem.mimeType,
                data: contentItem.data,
                url: imageData
              });
              
              textContent += (textContent ? '\n\n' : '') + `📷 Image generated (${contentItem.mimeType})`;
            }
            break;
            
          case 'resource':
            if ((contentItem as any).resource) {
              artifacts.push({
                id: `mcp-resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'json',
                title: `${toolName} - Resource Result`,
                content: JSON.stringify((contentItem as any).resource, null, 2),
                createdAt: new Date(),
                metadata: {
                  toolName,
                  source: 'mcp',
                  contentIndex: i,
                  originalType: 'resource'
                }
              });
              
              structuredResult.resource = (contentItem as any).resource;
              textContent += (textContent ? '\n\n' : '') + `📄 Resource: ${JSON.stringify((contentItem as any).resource, null, 2)}`;
            }
            break;
            
          default:
            if ((contentItem as any).data) {
              let contentData = (contentItem as any).data;
              if (typeof contentData === 'string') {
                try {
                  contentData = JSON.parse(contentData);
                } catch (e) {
                  // Keep as string if parsing fails
                }
              }
              
              artifacts.push({
                id: `mcp-data-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'json',
                title: `${toolName} - ${contentItem.type} Result`,
                content: JSON.stringify(contentData, null, 2),
                createdAt: new Date(),
                metadata: {
                  toolName,
                  source: 'mcp',
                  contentIndex: i,
                  originalType: contentItem.type
                }
              });
              
              structuredResult.data = contentData;
              textContent += (textContent ? '\n\n' : '') + `📊 ${contentItem.type}: ${JSON.stringify(contentData, null, 2)}`;
            }
            break;
        }
      }
    }

    // Fallback if no content was processed
    if (!textContent && Object.keys(structuredResult).length === 0) {
      textContent = mcpResult.success ? 'MCP tool executed successfully' : (mcpResult.error || 'MCP tool execution failed');
      structuredResult = { message: textContent };
    }

    // Create the tool message for the conversation
    const toolMessage: ChatMessage = {
      role: 'tool',
      content: textContent,
      name: toolName
    };

    // Add images to the tool message if any
    if (images.length > 0) {
      toolMessage.images = images;
    }

    return {
      result: Object.keys(structuredResult).length > 1 ? structuredResult : textContent,
      artifacts,
      images,
      toolMessage
    };
  }

  /**
   * Detect code language from filename
   */
  private detectCodeLanguage(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin'
    };
    return langMap[ext || ''] || 'text';
  }

  /**
   * Detect model type based on model name
   */
  private detectModelType(modelName: string): 'text' | 'vision' | 'code' | 'embedding' | 'multimodal' {
    const name = modelName.toLowerCase();
    
    if (name.includes('vision') || name.includes('llava') || name.includes('gpt-4-vision')) {
      return 'vision';
    }
    
    if (name.includes('code') || name.includes('coder') || name.includes('codellama')) {
      return 'code';
    }
    
    if (name.includes('embed') || name.includes('embedding')) {
      return 'embedding';
    }
    
    if (name.includes('gpt-4') || name.includes('claude') || name.includes('multimodal')) {
      return 'multimodal';
    }
    
    return 'text';
  }

  /**
   * Check if model supports vision
   */
  private supportsVision(modelName: string): boolean {
    return true;
  }

  /**
   * Check if model supports code generation
   */
  private supportsCode(modelName: string): boolean {
    return true;
  }

  /**
   * Check if model supports tool calling
   */
  private supportsTools(modelName: string): boolean {
    const name = modelName.toLowerCase();
    return name.includes('gpt-4') || 
           name.includes('gpt-3.5-turbo') ||
           name.includes('claude-3') ||
           name.includes('gemini');
  }

  /**
   * Get primary provider
   */
  public async getPrimaryProvider(): Promise<ClaraProvider | null> {
    try {
      const dbProvider = await db.getPrimaryProvider();
      if (!dbProvider) return null;

      return {
        id: dbProvider.id,
        name: dbProvider.name,
        type: dbProvider.type as ClaraProviderType,
        baseUrl: dbProvider.baseUrl,
        apiKey: dbProvider.apiKey,
        isEnabled: dbProvider.isEnabled,
        isPrimary: dbProvider.isPrimary,
        config: dbProvider.config
      };
    } catch (error) {
      console.error('Failed to get primary provider:', error);
      return null;
    }
  }

  /**
   * Set primary provider
   */
  public async setPrimaryProvider(providerId: string): Promise<void> {
    try {
      await db.setPrimaryProvider(providerId);
      
      // Update current client to use new primary provider
      const newPrimary = await this.getPrimaryProvider();
      if (newPrimary) {
        this.updateProvider(newPrimary);
      }
    } catch (error) {
      console.error('Failed to set primary provider:', error);
      throw error;
    }
  }

  /**
   * Health check for current provider
   */
  public async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      return await this.client.checkConnection();
    } catch (error) {
      console.warn('Provider health check failed:', error);
      return false;
    }
  }

  /**
   * Test connection to a provider
   */
  public async testProvider(provider: ClaraProvider): Promise<boolean> {
    try {
      const testClient = new AssistantAPIClient(provider.baseUrl || '', {
        apiKey: provider.apiKey || '',
        providerId: provider.id
      });
      
      return await testClient.checkConnection();
    } catch (error) {
      console.warn(`Provider ${provider.name} connection test failed:`, error);
      return false;
    }
  }

  /**
   * Stop the current chat generation
   */
  public stop(): void {
    // Set stop flag for autonomous mode
    this.stopExecution = true;
    
    if (this.client) {
      const apiClient = this.client as any;
      if (typeof apiClient.abortStream === 'function') {
        apiClient.abortStream();
        console.log('Stream aborted successfully');
      }
    }
  }

  /**
   * Get current API client instance
   */
  public getCurrentClient(): AssistantAPIClient | null {
    return this.client;
  }

  /**
   * Get current provider
   */
  public getCurrentProvider(): ClaraProvider | null {
    return this.currentProvider;
  }

  /**
   * Check if we should disable streaming for this provider when tools are present
   */
  private shouldDisableStreamingForTools(tools: Tool[]): boolean {
    // If no tools are present, streaming is fine
    if (!tools || tools.length === 0) {
      return false;
    }

    // If no current provider, default to disabling streaming with tools
    if (!this.currentProvider) {
      return true;
    }

    // Check provider type and base URL to determine if it's OpenAI-like
    const providerType = this.currentProvider.type?.toLowerCase();
    const baseUrl = this.currentProvider.baseUrl?.toLowerCase() || '';

    // Disable streaming for OpenAI-like providers when tools are present
    const isOpenAILike = 
      providerType === 'openai' ||
      providerType === 'openrouter' ||
      baseUrl.includes('openai.com') ||
      baseUrl.includes('openrouter.ai') ||
      baseUrl.includes('api.anthropic.com') ||
      baseUrl.includes('generativelanguage.googleapis.com');

    if (isOpenAILike) {
      return true;
    }

    // Keep streaming enabled for local providers like Ollama/llama.cpp
    const isLocalProvider = 
      providerType === 'ollama' ||
      baseUrl.includes('localhost') ||
      baseUrl.includes('127.0.0.1') ||
      baseUrl.includes('0.0.0.0');

    if (isLocalProvider) {
      return false;
    }

    // For unknown providers, default to disabling streaming with tools
    return true;
  }

  /**
   * Select the appropriate model based on context and configuration
   */
  private selectAppropriateModel(
    config: ClaraAIConfig, 
    message: string, 
    attachments: ClaraFileAttachment[],
    conversationHistory?: ClaraMessage[]
  ): string {
    // If auto model selection is disabled, use the configured text model
    if (!config.features.autoModelSelection) {
      return config.models.text || 'llama2';
    }

    // Check for images in current attachments
    const hasCurrentImages = attachments.some(att => att.type === 'image');
    
    // Check for images in conversation history
    const hasHistoryImages = conversationHistory ? 
      conversationHistory.slice(-10).some(msg => 
        msg.attachments && msg.attachments.some(att => att.type === 'image')
      ) : false;
    
    const hasImages = hasCurrentImages || hasHistoryImages;
    
    // Check for code-related content
    const hasCodeFiles = attachments.some(att => att.type === 'code');
    const hasCodeKeywords = /\b(code|programming|function|class|variable|debug|compile|syntax|algorithm|script|development)\b/i.test(message);
    const hasCodeContext = hasCodeFiles || hasCodeKeywords;
    
    // Check for tools mode
    const isToolsMode = config.features.enableTools && !config.features.enableStreaming;
    
    // Model selection priority:
    // 1. Vision model for images
    // 2. Code model for tools mode or code context
    // 3. Text model for general use
    
    if (hasImages && config.models.vision) {
      return config.models.vision;
    }
    
    if (isToolsMode && config.models.code) {
      return config.models.code;
    }
    
    if (hasCodeContext && config.models.code && config.features.enableStreaming) {
      return config.models.code;
    }
    
    // Default to text model
    return config.models.text || 'llama2';
  }

  /**
   * Preload/warm up a model
   */
  public async preloadModel(config: ClaraAIConfig, conversationHistory?: ClaraMessage[]): Promise<void> {
    if (!this.client || !config.models.text) {
      return;
    }

    // Only preload for local providers
    const isLocalProvider = config.provider === 'ollama' || 
                           this.currentProvider?.type === 'ollama' ||
                           this.currentProvider?.baseUrl?.includes('localhost') ||
                           this.currentProvider?.baseUrl?.includes('127.0.0.1');
    
    if (!isLocalProvider) {
      return;
    }

    try {
      let modelId = this.selectAppropriateModel(config, '', [], conversationHistory);
      
      if (modelId.includes(':')) {
        const parts = modelId.split(':');
        modelId = parts.slice(1).join(':');
      }

      const warmupMessages = [
        { role: 'system' as const, content: 'You are Clara, a helpful AI assistant.' },
        { role: 'user' as const, content: 'Hi' }
      ];

      const warmupOptions = {
        temperature: 0.1,
        max_tokens: 1,
        stream: false
      };

      this.client.sendChat(modelId, warmupMessages, warmupOptions).catch(() => {
        // Silently handle errors
      });
    } catch (error) {
      // Silently handle preload errors
    }
  }

  /**
   * Record a successful tool execution
   */
  public recordToolSuccess(toolName: string, toolDescription: string, toolCallId?: string): void {
    const providerPrefix = this.currentProvider?.id || 'unknown';
    
    ToolSuccessRegistry.recordSuccess(
      toolName,
      toolDescription,
      providerPrefix,
      toolCallId
    );
  }

  /**
   * Clear incorrectly blacklisted tools
   */
  public clearBlacklistedTools(): void {
    if (this.currentProvider?.id) {
      if (this.client) {
        const baseClient = this.client as any;
        
        if (baseClient.clearProblematicToolsForProvider) {
          baseClient.clearProblematicToolsForProvider(this.currentProvider.id);
        }
        
        if (baseClient.clearProblematicTools) {
          baseClient.clearProblematicTools();
        }
        
        addInfoNotification(
          'Tools Reset',
          `Cleared incorrectly blacklisted tools for ${this.currentProvider.name}.`,
          8000
        );
      }
    }
  }
}

// Export singleton instance
export const claraApiService = new ClaraApiService();