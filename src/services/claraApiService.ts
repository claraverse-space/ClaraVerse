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
  ClaraProviderType 
} from '../types/clara_assistant_types';
import { defaultTools, executeTool } from '../utils/claraTools';
import { db } from '../db';
import type { Tool } from '../db';

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

export class ClaraApiService {
  private client: AssistantAPIClient | null = null;
  private currentProvider: ClaraProvider | null = null;

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
   * Send a chat message using the AssistantAPIClient with streaming support
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
      
      console.log(`Sending request to AI provider with model: "${modelId}"`);

      // Prepare initial messages array
      const messages: ChatMessage[] = [];
      
      // Add system prompt if provided
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // Add conversation history if provided (excluding the current message which is already in the history)
      if (conversationHistory && conversationHistory.length > 0) {
        // Convert Clara messages to ChatMessage format, excluding the last message since it's the current one
        const historyMessages = conversationHistory.slice(0, -1); // Exclude the current message
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

      // Add the current user message (the last one from history if available, or construct it)
      const currentMessage = conversationHistory && conversationHistory.length > 0 
        ? conversationHistory[conversationHistory.length - 1] 
        : null;

      const userMessage: ChatMessage = {
        role: 'user',
        content: currentMessage?.content || message
      };

      // Add images if any attachments are images (prioritize current attachments over history)
      const imageAttachments = processedAttachments.filter(att => att.type === 'image');
      if (imageAttachments.length > 0) {
        userMessage.images = imageAttachments.map(att => att.base64 || att.url || '');
      } else if (currentMessage?.attachments) {
        // Fallback to attachments from conversation history
        const historyImageAttachments = currentMessage.attachments.filter(att => att.type === 'image');
        if (historyImageAttachments.length > 0) {
          userMessage.images = historyImageAttachments.map(att => att.base64 || att.url || '');
        }
      }

      messages.push(userMessage);

      console.log(`Sending ${messages.length} messages to AI (including system prompt and conversation context)`);

      // Get tools if enabled
      let tools: Tool[] = [];
      if (config.features.enableTools) {
        const dbTools = await db.getEnabledTools();
        tools = dbTools;
      }

      // Set up request options
      const options = {
        temperature: config.parameters.temperature,
        max_tokens: config.parameters.maxTokens,
        top_p: config.parameters.topP,
        useRag: config.features.enableRAG
      };

      let responseContent = '';
      let toolCalls: any[] = [];
      let finishReason = '';
      let totalTokens = 0;

      // First attempt with streaming if enabled
      if (config.features.enableStreaming) {
        try {
          // Handle streaming with real-time content updates
          const collectedToolCalls: any[] = [];
          
          for await (const chunk of this.client.streamChat(modelId, messages, options, tools)) {
            // Stream content in real-time
            if (chunk.message?.content) {
              responseContent += chunk.message.content;
              // Call the streaming callback if provided
              if (onContentChunk) {
                onContentChunk(chunk.message.content);
              }
            }
            
            // Collect tool calls
            if (chunk.message?.tool_calls) {
              for (const toolCall of chunk.message.tool_calls) {
                // Find existing tool call or create new one
                let existingCall = collectedToolCalls.find(c => c.id === toolCall.id);
                if (!existingCall) {
                  existingCall = {
                    id: toolCall.id,
                    type: toolCall.type || 'function',
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: ''
                    }
                  };
                  collectedToolCalls.push(existingCall);
                }
                
                // Append function name and arguments
                if (toolCall.function?.name) {
                  existingCall.function.name = toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  existingCall.function.arguments += toolCall.function.arguments;
                }
              }
            }
            
            // Check finish reason
            if (chunk.finish_reason) {
              finishReason = chunk.finish_reason;
            }
            
            // Get token usage
            if (chunk.usage?.total_tokens) {
              totalTokens = chunk.usage.total_tokens;
            }
          }
          
          // If we have tool calls, execute them and continue conversation
          if (finishReason === 'tool_calls' && collectedToolCalls.length > 0) {
            // Notify about tool execution
            if (onContentChunk) {
              onContentChunk('\n\n🔧 Executing tools...\n');
            }
            
            // Add assistant message with tool calls to conversation
            messages.push({
              role: 'assistant',
              content: responseContent,
              tool_calls: collectedToolCalls
            });
            
            // Execute tools and add results to conversation
            const toolResults = await this.executeToolCalls(collectedToolCalls);
            for (const result of toolResults) {
              const toolCall = collectedToolCalls.find(tc => 
                tc.function.name === result.toolName
              );
              if (toolCall) {
                messages.push({
                  role: 'tool',
                  content: JSON.stringify(result.result),
                  name: result.toolName
                });
              }
            }
            
            // Notify about continuation
            if (onContentChunk) {
              onContentChunk('✅ Tools executed. Generating response...\n\n');
            }
            
            // Continue conversation to get final response
            const previousContent = responseContent;
            responseContent = '';
            
            for await (const chunk of this.client.streamChat(modelId, messages, options)) {
              if (chunk.message?.content) {
                responseContent += chunk.message.content;
                // Stream the final response content
                if (onContentChunk) {
                  onContentChunk(chunk.message.content);
                }
              }
              if (chunk.usage?.total_tokens) {
                totalTokens = chunk.usage.total_tokens;
              }
            }
            
            // Prepend the tool execution info to the final response
            responseContent = previousContent + '\n\n🔧 Tools executed successfully.\n\n' + responseContent;
            toolCalls = toolResults;
          }

        } catch (streamError: any) {
          // Enhanced error detection and debugging
          console.log('🔍 Stream error details:', {
            error: streamError,
            message: streamError.message,
            errorData: streamError.errorData,
            status: streamError.status,
            type: typeof streamError,
            keys: Object.keys(streamError)
          });

          // Multiple ways to extract error message
          const errorMessage = streamError.message || 
                              streamError.error?.message || 
                              streamError.response?.data?.error?.message ||
                              streamError.errorData?.error?.message ||
                              streamError.errorData?.message ||
                              JSON.stringify(streamError);
          
          // Enhanced error pattern detection
          const lowerErrorMessage = errorMessage.toLowerCase();
          const isToolsStreamError = (
            lowerErrorMessage.includes('cannot use tools with stream') ||
            lowerErrorMessage.includes('tools with stream') ||
            lowerErrorMessage.includes('streaming with tools') ||
            lowerErrorMessage.includes('tools are not supported with streaming') ||
            lowerErrorMessage.includes('streaming is not supported with tools') ||
            (lowerErrorMessage.includes('stream') && lowerErrorMessage.includes('tools'))
          );
          
          console.log('🔍 Error analysis:', {
            originalMessage: errorMessage,
            lowerMessage: lowerErrorMessage,
            isToolsStreamError,
            hasTools: tools.length > 0,
            willFallback: isToolsStreamError && tools.length > 0
          });
          
          if (isToolsStreamError && tools.length > 0) {
            console.log('🔄 Provider does not support streaming with tools. Retrying without streaming...');
            
            // Notify user about fallback
            if (onContentChunk) {
              onContentChunk('⚠️ Switching to non-streaming mode for tool support...\n\n');
            }
            
            // Fallback to non-streaming mode
            const response = await this.client.sendChat(modelId, messages, options, tools);
            responseContent = response.message?.content || 'No response generated.';
            totalTokens = response.usage?.total_tokens || 0;
            
            // Handle tool calls if present
            if (response.message?.tool_calls) {
              // Add assistant message with tool calls
              messages.push({
                role: 'assistant',
                content: responseContent,
                tool_calls: response.message.tool_calls
              });
              
              // Execute tools and add results
              const toolResults = await this.executeToolCalls(response.message.tool_calls);
              for (const result of toolResults) {
                const toolCall = response.message.tool_calls.find((tc: any) => 
                  tc.function.name === result.toolName
                );
                if (toolCall) {
                  messages.push({
                    role: 'tool',
                    content: JSON.stringify(result.result),
                    name: result.toolName
                  });
                }
              }
              
              // Get final response after tool execution
              const finalResponse = await this.client.sendChat(modelId, messages, options);
              responseContent = (responseContent + '\n\n🔧 Tools executed successfully.\n\n' + (finalResponse.message?.content || ''));
              totalTokens = finalResponse.usage?.total_tokens || totalTokens;
              
              toolCalls = toolResults;
            }
            
            // Stream the final content if callback is provided
            if (onContentChunk && responseContent) {
              onContentChunk(responseContent);
            }
          } else {
            // Re-throw other streaming errors
            throw streamError;
          }
        }
        
      } else {
        // Non-streaming request (original path)
        const response = await this.client.sendChat(modelId, messages, options, tools);
        responseContent = response.message?.content || 'No response generated.';
        totalTokens = response.usage?.total_tokens || 0;
        
        // Handle tool calls if present
        if (response.message?.tool_calls) {
          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: responseContent,
            tool_calls: response.message.tool_calls
          });
          
          // Execute tools and add results
          const toolResults = await this.executeToolCalls(response.message.tool_calls);
          for (const result of toolResults) {
            const toolCall = response.message.tool_calls.find((tc: any) => 
              tc.function.name === result.toolName
            );
            if (toolCall) {
              messages.push({
                role: 'tool',
                content: JSON.stringify(result.result),
                name: result.toolName
              });
            }
          }
          
          // Get final response after tool execution
          const finalResponse = await this.client.sendChat(modelId, messages, options);
          responseContent = (responseContent + '\n\n🔧 Tools executed successfully.\n\n' + (finalResponse.message?.content || ''));
          totalTokens = finalResponse.usage?.total_tokens || totalTokens;
          
          toolCalls = toolResults;
        }
      }

      // Create Clara message from response
      const claraMessage: ClaraMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: responseContent || 'No response generated.',
        timestamp: new Date(),
        attachments: processedAttachments,
        metadata: {
          model: `${config.provider}:${modelId}`,
          tokens: totalTokens,
          temperature: config.parameters.temperature,
          toolsUsed: toolCalls.map(tc => tc.toolName)
        }
      };

      // Add artifacts if any were generated from tool calls
      if (toolCalls.length > 0) {
        claraMessage.artifacts = this.parseToolResultsToArtifacts(toolCalls);
      }

      return claraMessage;

    } catch (error) {
      console.error('Chat request failed:', error);
      
      // Check if this is an abort error (user stopped the stream)
      const isAbortError = error instanceof Error && (
        error.message.includes('aborted') ||
        error.message.includes('BodyStreamBuffer was aborted') ||
        error.message.includes('AbortError') ||
        error.name === 'AbortError'
      );
      
      if (isAbortError) {
        console.log('Stream was aborted by user, returning partial content');
        
        // Return a message indicating the stream was aborted
        // The actual streamed content is preserved by the component via callback
        return {
          id: `${Date.now()}-aborted`,
          role: 'assistant',
          content: '', // Component preserves the actual streamed content
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
}

// Export singleton instance
export const claraApiService = new ClaraApiService(); 