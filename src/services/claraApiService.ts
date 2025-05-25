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
  ClaraFileProcessingResult,
  ClaraProviderType,
  ClaraMCPToolCall,
  ClaraMCPToolResult
} from '../types/clara_assistant_types';
import { defaultTools, executeTool } from '../utils/claraTools';
import { db } from '../db';
import type { Tool } from '../db';
import { claraMCPService } from './claraMCPService';

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
 * Enhanced autonomous agent configuration
 */
interface AutonomousAgentConfig {
  maxRetries: number;
  retryDelay: number;
  enableSelfCorrection: boolean;
  enableToolGuidance: boolean;
  enableProgressTracking: boolean;
  maxToolCalls: number;
  confidenceThreshold: number;
}

/**
 * Tool execution attempt tracking
 */
interface ToolExecutionAttempt {
  attempt: number;
  toolName: string;
  arguments: any;
  error?: string;
  success: boolean;
  timestamp: Date;
}

/**
 * Agent execution context
 */
interface AgentExecutionContext {
  originalQuery: string;
  attempts: ToolExecutionAttempt[];
  toolsAvailable: string[];
  currentStep: number;
  maxSteps: number;
  progressLog: string[];
}

export class ClaraApiService {
  private client: AssistantAPIClient | null = null;
  private currentProvider: ClaraProvider | null = null;
  
  // Enhanced autonomous agent configuration
  private agentConfig: AutonomousAgentConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    enableSelfCorrection: true,
    enableToolGuidance: true,
    enableProgressTracking: true,
    maxToolCalls: 10,
    confidenceThreshold: 0.7
  };

  constructor() {
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
      apiKey: provider.apiKey || ''
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

      // If no providers exist, create default ones
      if (claraProviders.length === 0) {
        await this.initializeDefaultProviders();
        return this.getProviders();
      }

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
          apiKey: provider.apiKey || ''
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
   * Send a chat message using the AssistantAPIClient with enhanced autonomous agent capabilities
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

    try {
      // Update agent config from session config
      if (config.autonomousAgent) {
        this.agentConfig = {
          maxRetries: config.autonomousAgent.maxRetries,
          retryDelay: config.autonomousAgent.retryDelay,
          enableSelfCorrection: config.autonomousAgent.enableSelfCorrection,
          enableToolGuidance: config.autonomousAgent.enableToolGuidance,
          enableProgressTracking: config.autonomousAgent.enableProgressTracking,
          maxToolCalls: config.autonomousAgent.maxToolCalls,
          confidenceThreshold: config.autonomousAgent.confidenceThreshold
        };
      }

      // Initialize agent execution context
      const agentContext: AgentExecutionContext = {
        originalQuery: message,
        attempts: [],
        toolsAvailable: [],
        currentStep: 0,
        maxSteps: this.agentConfig.maxToolCalls,
        progressLog: []
      };

      // Process file attachments if any
      const processedAttachments = await this.processFileAttachments(attachments || []);

      // Get the model from config - extract the actual model name after provider prefix
      let modelId = config.models.text || 'llama2';
      
      // If the model ID includes the provider prefix (e.g., "ollama:qwen3:30b"), 
      // extract everything after the first colon to get the actual model name
      if (modelId.includes(':')) {
        const parts = modelId.split(':');
        // Remove the provider part (first element) and rejoin the rest
        const originalModelId = modelId;
        modelId = parts.slice(1).join(':');
        console.log(`Model ID extraction: "${originalModelId}" -> "${modelId}"`);
      }
      
      console.log(`🤖 Starting autonomous agent with model: "${modelId}"`);
      console.log('🔧 Agent configuration:', this.agentConfig);

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
              // Get MCP tools from enabled servers
              const enabledServers = config.mcp.enabledServers || [];
              console.log('📋 Enabled MCP servers:', enabledServers);
              
              const mcpTools = enabledServers.length > 0 
                ? claraMCPService.getToolsFromServers(enabledServers)
                : claraMCPService.getAvailableTools();
              
              console.log(`🛠️ Found ${mcpTools.length} MCP tools:`, mcpTools.map(t => `${t.server}:${t.name}`));
              
              // Convert MCP tools to OpenAI format and add to tools array
              const mcpOpenAITools = claraMCPService.convertToolsToOpenAIFormat();
              console.log(`🔄 Converted to ${mcpOpenAITools.length} OpenAI format tools`);
              
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
              
              // Update agent context with available tools
              agentContext.toolsAvailable = tools.map(t => t.name);
            } else {
              console.warn('⚠️ MCP service not ready, skipping MCP tools');
            }
          } catch (error) {
            console.error('❌ Error adding MCP tools:', error);
          }
        } else {
          console.log('🚫 MCP tools disabled:', {
            enableMCP: config.features.enableMCP,
            enableTools: config.mcp?.enableTools
          });
        }
      }

      // Enhanced system prompt with autonomous agent capabilities
      const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(systemPrompt, tools, agentContext);

      // Prepare initial messages array
      const messages: ChatMessage[] = [];
      
      // Add enhanced system prompt
      messages.push({
        role: 'system',
        content: enhancedSystemPrompt
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
      }

      // Add the current user message
      const currentMessage = conversationHistory && conversationHistory.length > 0 
        ? conversationHistory[conversationHistory.length - 1] 
        : null;

      const userMessage: ChatMessage = {
        role: 'user',
        content: currentMessage?.content || message
      };

      // Add images if any attachments are images
      const imageAttachments = processedAttachments.filter(att => att.type === 'image');
      if (imageAttachments.length > 0) {
        userMessage.images = imageAttachments.map(att => att.base64 || att.url || '');
      } else if (currentMessage?.attachments) {
        const historyImageAttachments = currentMessage.attachments.filter(att => att.type === 'image');
        if (historyImageAttachments.length > 0) {
          userMessage.images = historyImageAttachments.map(att => att.base64 || att.url || '');
        }
      }

      messages.push(userMessage);

      console.log(`🚀 Starting autonomous agent execution with ${messages.length} messages and ${tools.length} tools`);

      // Execute autonomous agent workflow
      const result = await this.executeAutonomousAgent(
        modelId, 
        messages, 
        tools, 
        config, 
        agentContext,
        onContentChunk
      );

      return result;

    } catch (error) {
      console.error('Autonomous agent execution failed:', error);
      
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
   * Execute tool calls using the Clara tools system
   */
  private async executeToolCalls(toolCalls: any[]): Promise<any[]> {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const functionName = toolCall.function?.name;
        const args = typeof toolCall.function?.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function?.arguments || {};

        // Check if this is an MCP tool call
        if (functionName?.startsWith('mcp_')) {
          try {
            // Parse MCP tool calls and execute them
            const mcpToolCalls = claraMCPService.parseOpenAIToolCalls([toolCall]);
            
            if (mcpToolCalls.length > 0) {
              const mcpResult = await claraMCPService.executeToolCall(mcpToolCalls[0]);
              
              results.push({
                toolName: functionName,
                success: mcpResult.success,
                result: mcpResult.success ? mcpResult.content?.[0]?.text || 'MCP tool executed successfully' : null,
                error: mcpResult.error,
                metadata: {
                  type: 'mcp',
                  server: mcpToolCalls[0].server,
                  toolName: mcpToolCalls[0].name,
                  ...mcpResult.metadata
                }
              });
            } else {
              results.push({
                toolName: functionName,
                success: false,
                error: 'Failed to parse MCP tool call'
              });
            }
          } catch (mcpError) {
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
            // Execute database tool (simplified implementation)
            try {
              const funcBody = `return (async () => {
                ${dbTool.implementation}
                return await implementation(args);
              })();`;
              const testFunc = new Function('args', funcBody);
              const result = await testFunc(args);
              
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
      if (result.success && result.result) {
        // Check if result contains code, data, or other artifact-worthy content
        if (typeof result.result === 'object') {
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
    // Remove filter - allow all models to be used for vision tasks
    return true;
  }

  /**
   * Check if model supports code generation
   */
  private supportsCode(modelName: string): boolean {
    // Remove filter - allow all models to be used for code tasks  
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
   * Initialize default providers if none exist
   */
  private async initializeDefaultProviders(): Promise<void> {
    try {
      const defaultProviders = [
        {
          name: 'Ollama (Local)',
          type: 'ollama' as ClaraProviderType,
          baseUrl: 'http://localhost:11434',
          isEnabled: true,
          isPrimary: true
        },
        {
          name: 'OpenAI',
          type: 'openai' as ClaraProviderType,
          baseUrl: 'https://api.openai.com/v1',
          isEnabled: false,
          isPrimary: false
        },
        {
          name: 'OpenRouter',
          type: 'openrouter' as ClaraProviderType,
          baseUrl: 'https://openrouter.ai/api/v1',
          isEnabled: false,
          isPrimary: false
        }
      ];

      for (const provider of defaultProviders) {
        await db.addProvider(provider);
      }
    } catch (error) {
      console.error('Failed to initialize default providers:', error);
    }
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
        apiKey: provider.apiKey || ''
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
    if (this.client) {
      // The client extends APIClient which has the abortStream method
      const apiClient = this.client as any;
      if (typeof apiClient.abortStream === 'function') {
        apiClient.abortStream();
        console.log('Stream aborted successfully');
      } else {
        console.warn('AbortStream method not available on client');
      }
    } else {
      console.warn('No client available to abort');
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
   * Build enhanced system prompt with autonomous agent capabilities
   */
  private buildEnhancedSystemPrompt(
    originalPrompt: string | undefined, 
    tools: Tool[], 
    context: AgentExecutionContext
  ): string {
    const toolsList = tools.map(tool => {
      const requiredParams = tool.parameters.filter(p => p.required).map(p => p.name);
      const optionalParams = tool.parameters.filter(p => !p.required).map(p => p.name);
      
      return `- ${tool.name}: ${tool.description}
  Required: ${requiredParams.join(', ') || 'none'}
  Optional: ${optionalParams.join(', ') || 'none'}`;
    }).join('\n');

    const enhancedPrompt = `${originalPrompt || 'You are Clara, a helpful AI assistant.'} 

🤖 AUTONOMOUS AGENT MODE ACTIVATED 🤖

You are now operating as an advanced autonomous agent with the following capabilities:

CORE PRINCIPLES:
1. **Persistence**: If a tool call fails, analyze the error and retry with corrected parameters
2. **Self-Correction**: Learn from errors and adjust your approach automatically  
3. **Tool Mastery**: Use tools effectively by carefully reading their descriptions and requirements
4. **Progress Tracking**: Keep the user informed of your progress and reasoning

AVAILABLE TOOLS:
${toolsList || 'No tools available'}

TOOL USAGE GUIDELINES:
- **Always double-check tool names** - they must match exactly (case-sensitive)
- **Validate all required parameters** before making tool calls
- **If a tool fails**, analyze the error message and retry with corrections
- **Use descriptive reasoning** - explain what you're doing and why
- **Chain tools logically** - use outputs from one tool as inputs to another when appropriate

ERROR HANDLING PROTOCOL:
1. If a tool call fails due to misspelling, immediately retry with the correct spelling
2. If parameters are missing/invalid, retry with proper parameters
3. If a tool doesn't exist, suggest alternatives or explain limitations
4. Maximum ${this.agentConfig.maxRetries} retries per tool before moving to alternatives

RESPONSE FORMAT:
- Start with your reasoning and plan
- Clearly indicate when you're using tools
- Explain any errors and how you're fixing them
- Provide a comprehensive final answer

Remember: You are autonomous and capable. Take initiative, solve problems step by step, and don't give up easily!`;

    return enhancedPrompt;
  }

  /**
   * Execute autonomous agent workflow with retry mechanisms and self-correction
   */
  private async executeAutonomousAgent(
    modelId: string,
    messages: ChatMessage[],
    tools: Tool[],
    config: ClaraAIConfig,
    context: AgentExecutionContext,
    onContentChunk?: (content: string) => void
  ): Promise<ClaraMessage> {
    const options = {
      temperature: config.parameters.temperature,
      max_tokens: config.parameters.maxTokens,
      top_p: config.parameters.topP,
      useRag: config.features.enableRAG
    };

    let responseContent = '';
    let totalTokens = 0;
    let allToolResults: any[] = [];
    let conversationMessages = [...messages];

    // Progress tracking
    if (onContentChunk && this.agentConfig.enableProgressTracking) {
      onContentChunk('🤖 **Autonomous Agent Activated**\n\n');
    }

    // Main agent execution loop
    for (let step = 0; step < context.maxSteps; step++) {
      context.currentStep = step;
      
      try {
        if (onContentChunk && this.agentConfig.enableProgressTracking && step > 0) {
          onContentChunk(`\n🔄 **Step ${step + 1}**: Continuing analysis...\n\n`);
        }

        let stepResponse;
        let finishReason = '';

        // Try streaming first if enabled
        if (config.features.enableStreaming) {
          try {
            const collectedToolCalls: any[] = [];
            let stepContent = '';

            for await (const chunk of this.client!.streamChat(modelId, conversationMessages, options, tools)) {
              if (chunk.message?.content) {
                stepContent += chunk.message.content;
                if (onContentChunk) {
                  onContentChunk(chunk.message.content);
                }
              }

              // Collect tool calls
              if (chunk.message?.tool_calls) {
                for (const toolCall of chunk.message.tool_calls) {
                  let existingCall = collectedToolCalls.find(c => c.id === toolCall.id);
                  if (!existingCall) {
                    existingCall = {
                      id: toolCall.id,
                      type: toolCall.type || 'function',
                      function: { name: toolCall.function?.name || '', arguments: '' }
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

              if (chunk.finish_reason) {
                finishReason = chunk.finish_reason;
              }
              if (chunk.usage?.total_tokens) {
                totalTokens = chunk.usage.total_tokens;
              }
            }

            stepResponse = {
              message: {
                content: stepContent,
                tool_calls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined
              },
              usage: { total_tokens: totalTokens }
            };
            responseContent += stepContent;

          } catch (streamError: any) {
            // Fallback to non-streaming if streaming fails with tools
            const errorMessage = streamError.message?.toLowerCase() || '';
            if (errorMessage.includes('stream') && errorMessage.includes('tool') && tools.length > 0) {
              if (onContentChunk) {
                onContentChunk('\n⚠️ Switching to non-streaming mode for tool support...\n\n');
              }
              stepResponse = await this.client!.sendChat(modelId, conversationMessages, options, tools);
              responseContent += stepResponse.message?.content || '';
              totalTokens = stepResponse.usage?.total_tokens || 0;
            } else {
              throw streamError;
            }
          }
        } else {
          // Non-streaming mode
          stepResponse = await this.client!.sendChat(modelId, conversationMessages, options, tools);
          const stepContent = stepResponse.message?.content || '';
          responseContent += stepContent;
          totalTokens = stepResponse.usage?.total_tokens || 0;
          
          if (onContentChunk && stepContent) {
            onContentChunk(stepContent);
          }
        }

        // Handle tool calls with retry mechanism
        if (stepResponse.message?.tool_calls && stepResponse.message.tool_calls.length > 0) {
          if (onContentChunk) {
            onContentChunk('\n\n🔧 **Executing tools...**\n\n');
          }

          // Add assistant message with tool calls
          conversationMessages.push({
            role: 'assistant',
            content: stepResponse.message.content || '',
            tool_calls: stepResponse.message.tool_calls
          });

          // Execute tools with enhanced retry logic
          const toolResults = await this.executeToolCallsWithRetry(
            stepResponse.message.tool_calls, 
            context,
            onContentChunk
          );

          // Add tool results to conversation
          for (const result of toolResults) {
            const toolCall = stepResponse.message.tool_calls.find((tc: any) => 
              tc.function.name === result.toolName
            );
            if (toolCall) {
              conversationMessages.push({
                role: 'tool',
                content: JSON.stringify(result.result),
                name: result.toolName
              });
            }
          }

          allToolResults.push(...toolResults);

          if (onContentChunk) {
            onContentChunk('✅ **Tools executed successfully**\n\n');
          }

          // Continue to next iteration for follow-up response
          continue;
        }

        // If no tool calls, we're done
        break;

      } catch (error) {
        console.error(`Agent step ${step + 1} failed:`, error);
        
        if (onContentChunk) {
          onContentChunk(`\n❌ **Error in step ${step + 1}**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`);
        }

        // Try to recover or break if too many failures
        if (step >= this.agentConfig.maxRetries) {
          break;
        }
      }
    }

    // Create final Clara message
    const claraMessage: ClaraMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: responseContent || 'I completed the autonomous agent execution.',
      timestamp: new Date(),
      metadata: {
        model: `${config.provider}:${modelId}`,
        tokens: totalTokens,
        temperature: config.parameters.temperature,
        toolsUsed: allToolResults.map(tc => tc.toolName),
        agentSteps: context.currentStep + 1,
        autonomousMode: true
      }
    };

    // Add artifacts if any were generated from tool calls
    if (allToolResults.length > 0) {
      claraMessage.artifacts = this.parseToolResultsToArtifacts(allToolResults);
    }

    return claraMessage;
  }

  /**
   * Execute tool calls with enhanced retry mechanism and error correction
   */
  private async executeToolCallsWithRetry(
    toolCalls: any[], 
    context: AgentExecutionContext,
    onContentChunk?: (content: string) => void
  ): Promise<any[]> {
    const results = [];

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function?.name;
      let args = toolCall.function?.arguments;

      // Parse arguments if they're a string
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch (parseError) {
          if (onContentChunk) {
            onContentChunk(`⚠️ **Argument parsing failed for ${functionName}**: ${parseError}\n`);
          }
          results.push({
            toolName: functionName,
            success: false,
            error: `Failed to parse arguments: ${parseError}`
          });
          continue;
        }
      }

      // Retry mechanism for each tool call
      let lastError = '';
      let success = false;
      let result = null;

      for (let attempt = 1; attempt <= this.agentConfig.maxRetries; attempt++) {
        try {
          // Track attempt
          const attemptRecord: ToolExecutionAttempt = {
            attempt,
            toolName: functionName,
            arguments: args,
            success: false,
            timestamp: new Date()
          };

          if (onContentChunk && attempt > 1) {
            onContentChunk(`🔄 **Retry ${attempt}/${this.agentConfig.maxRetries}** for ${functionName}\n`);
          }

          // Check if this is an MCP tool call
          if (functionName?.startsWith('mcp_')) {
            const mcpToolCalls = claraMCPService.parseOpenAIToolCalls([toolCall]);
            
            if (mcpToolCalls.length > 0) {
              const mcpResult = await claraMCPService.executeToolCall(mcpToolCalls[0]);
              
              if (mcpResult.success) {
                result = {
                  toolName: functionName,
                  success: true,
                  result: mcpResult.content?.[0]?.text || 'MCP tool executed successfully',
                  metadata: {
                    type: 'mcp',
                    server: mcpToolCalls[0].server,
                    toolName: mcpToolCalls[0].name,
                    attempts: attempt,
                    ...mcpResult.metadata
                  }
                };
                success = true;
                attemptRecord.success = true;
              } else {
                lastError = mcpResult.error || 'MCP tool execution failed';
                attemptRecord.error = lastError;
              }
            } else {
              lastError = 'Failed to parse MCP tool call';
              attemptRecord.error = lastError;
            }
          } else {
            // Regular tool execution
            const claraTool = defaultTools.find(tool => tool.name === functionName || tool.id === functionName);
            
            if (claraTool) {
              const toolResult = await executeTool(claraTool.id, args);
              if (toolResult.success) {
                result = {
                  toolName: functionName,
                  success: true,
                  result: toolResult.result,
                  metadata: { attempts: attempt }
                };
                success = true;
                attemptRecord.success = true;
              } else {
                lastError = toolResult.error || 'Tool execution failed';
                attemptRecord.error = lastError;
              }
            } else {
              // Try database tools
              const dbTools = await db.getEnabledTools();
              const dbTool = dbTools.find(tool => tool.name === functionName);
              
              if (dbTool) {
                try {
                  const funcBody = `return (async () => {
                    ${dbTool.implementation}
                    return await implementation(args);
                  })();`;
                  const testFunc = new Function('args', funcBody);
                  const dbResult = await testFunc(args);
                  
                  result = {
                    toolName: functionName,
                    success: true,
                    result: dbResult,
                    metadata: { attempts: attempt }
                  };
                  success = true;
                  attemptRecord.success = true;
                } catch (dbError) {
                  lastError = dbError instanceof Error ? dbError.message : 'Database tool execution failed';
                  attemptRecord.error = lastError;
                }
              } else {
                lastError = `Tool '${functionName}' not found. Available tools: ${context.toolsAvailable.join(', ')}`;
                attemptRecord.error = lastError;
              }
            }
          }

          context.attempts.push(attemptRecord);

          if (success) {
            if (onContentChunk && attempt > 1) {
              onContentChunk(`✅ **Success** on attempt ${attempt}\n`);
            }
            break;
          }

          // Wait before retry
          if (attempt < this.agentConfig.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, this.agentConfig.retryDelay));
          }

        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error occurred';
          context.attempts.push({
            attempt,
            toolName: functionName,
            arguments: args,
            error: lastError,
            success: false,
            timestamp: new Date()
          });

          if (onContentChunk) {
            onContentChunk(`❌ **Attempt ${attempt} failed**: ${lastError}\n`);
          }
        }
      }

      // Add final result
      if (success && result) {
        results.push(result);
      } else {
        results.push({
          toolName: functionName,
          success: false,
          error: lastError,
          metadata: { attempts: this.agentConfig.maxRetries }
        });
        
        if (onContentChunk) {
          onContentChunk(`💥 **Tool ${functionName} failed after ${this.agentConfig.maxRetries} attempts**: ${lastError}\n\n`);
        }
      }
    }

    return results;
  }
}

// Export singleton instance
export const claraApiService = new ClaraApiService(); 