import type { Tool } from '../db';

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  images?: string[];
  tool_calls?: any[];
  name?: string; // For tool responses
  tool_call_id?: string; // Required for OpenAI tool messages
}

export interface RequestOptions {
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Tool[];
  max_tokens?: number;
  [key: string]: any;
}

export interface APIConfig {
  apiKey: string;
  baseUrl: string;
}

interface APIResponse {
  message?: {
    content: string;
    role: ChatRole;
    tool_calls?: {
      id?: string;
      type?: string;
      function: {
        name: string;
        arguments: string | Record<string, unknown>;
      };
    }[];
  };
  choices?: [{
    message: {
      content: string;
      role: string;
      tool_calls?: any[];
    };
    delta?: {
      content?: string;
      role?: string;
      tool_calls?: any[];
    };
    finish_reason?: string;
  }];
  finish_reason?: string;
  usage?: {
    total_tokens: number;
  };
}

export class APIClient {
  private abortController: AbortController | null = null;
  private config: APIConfig;
  private static problematicTools: Set<string> = new Set();

  constructor(baseUrl: string, config?: Partial<APIConfig>) {
    this.config = {
      apiKey: config?.apiKey || '',
      baseUrl: baseUrl
    };
  }

  /**
   * Get the current configuration
   */
  public getConfig(): APIConfig {
    return { ...this.config };
  }

  /**
   * Helper for making API requests.
   */
  private async request(endpoint: string, method: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      // Try to parse the error response to get detailed error information
      let errorData: any = null;
      let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
      
      try {
        errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        // If JSON parsing fails, use the original error message
        console.warn('Failed to parse error response:', parseError);
      }
      
      // Create error with detailed information
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).errorData = errorData;
      throw error;
    }

    return response.json();
  }

  /**
   * Lists available models
   */
  public async listModels(): Promise<any[]> {
    try {
      const response = await this.request('/models', 'GET');
      
      // Handle different response formats
      if (Array.isArray(response?.data)) {
        return response.data.map((model: any) => ({
          name: model.id,
          id: model.id,
          digest: model.created?.toString() || '',
          size: 0,
          modified_at: model.created?.toString() || ''
        }));
      } else if (Array.isArray(response)) {
        return response.map((model: any) => ({
          name: model.id || model.name,
          id: model.id || model.name,
          digest: model.created?.toString() || '',
          size: 0,
          modified_at: model.created?.toString() || ''
        }));
      } else {
        console.warn('Unexpected model list format:', response);
        return [];
      }
    } catch (error) {
      console.error('Error listing models:', error);
      throw error;
    }
  }

  /**
   * Aborts any ongoing stream requests.
   */
  public abortStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Send a chat message with optional tools.
   */
  public async sendChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {},
    tools?: Tool[]
  ): Promise<APIResponse> {
    return this.sendChatWithDynamicToolRemoval(model, messages, options, tools);
  }

  /**
   * Send a chat message with dynamic tool removal on validation errors
   */
  private async sendChatWithDynamicToolRemoval(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {},
    tools?: Tool[],
    attempt: number = 1
  ): Promise<APIResponse> {
    // No limit on attempts - keep trying until all problematic tools are removed
    let currentTools = tools ? [...tools] : undefined;
    
    // Filter out known problematic tools before starting
    if (currentTools && currentTools.length > 0) {
      const originalCount = currentTools.length;
      currentTools = this.filterOutProblematicTools(currentTools);
      if (currentTools.length < originalCount) {
        console.log(`🔧 [DYNAMIC-TOOLS] Filtered out ${originalCount - currentTools.length} known problematic tools, ${currentTools.length} remaining`);
      }
    }
    
    const formattedTools = currentTools?.map(tool => this.formatTool(tool));
    
    const payload = {
      model,
      messages: this.prepareMessages(messages),
      stream: false,
      ...options
    };

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
    }

    try {
      console.log(`🔧 [DYNAMIC-TOOLS] Attempt ${attempt}: Sending request with ${formattedTools?.length || 0} tools`);
      const response = await this.request('/chat/completions', 'POST', payload);
      
      console.log(`✅ [DYNAMIC-TOOLS] Request successful on attempt ${attempt}`);
      return {
        message: {
          content: response.choices?.[0]?.message?.content || '',
          role: response.choices?.[0]?.message?.role as ChatRole,
          tool_calls: response.choices?.[0]?.message?.tool_calls
        },
        usage: response.usage
      };
    } catch (error: any) {
      console.log(`🔍 [DYNAMIC-TOOLS-DEBUG] Caught error:`, {
        message: error.message,
        status: error.status,
        errorData: error.errorData
      });
      
      // Check if this is an OpenAI tool validation error
      const isToolValidationError = this.isOpenAIToolValidationError(error);
      console.log(`🔍 [DYNAMIC-TOOLS-DEBUG] Is tool validation error:`, isToolValidationError);
      
      if (isToolValidationError && currentTools && currentTools.length > 0) {
        const problematicToolIndex = this.extractProblematicToolIndex(error);
        console.log(`🔍 [DYNAMIC-TOOLS-DEBUG] Problematic tool index:`, problematicToolIndex);
        
        if (problematicToolIndex !== null && problematicToolIndex < currentTools.length) {
          const removedTool = currentTools[problematicToolIndex];
          console.warn(`⚠️ [DYNAMIC-TOOLS] Removing problematic tool at index ${problematicToolIndex}: ${removedTool.name}`);
          console.warn(`⚠️ [DYNAMIC-TOOLS] Error details:`, error.message);
          
          // Store the problematic tool so it won't be loaded again
          this.storeProblematicTool(removedTool, error.message);
          
          // Remove the problematic tool
          currentTools.splice(problematicToolIndex, 1);
          
          // Retry with remaining tools
          console.log(`🔄 [DYNAMIC-TOOLS] Retrying with ${currentTools.length} remaining tools...`);
          return this.sendChatWithDynamicToolRemoval(model, messages, options, currentTools, attempt + 1);
        } else {
          console.warn(`⚠️ [DYNAMIC-TOOLS] Could not identify problematic tool index from error`);
          
          // If we can't identify the specific tool, remove the first tool and try again
          // This is a fallback to ensure we make progress
          if (currentTools.length > 0) {
            const removedTool = currentTools[0];
            console.warn(`⚠️ [DYNAMIC-TOOLS] Removing first tool as fallback: ${removedTool.name}`);
            this.storeProblematicTool(removedTool, error.message);
            currentTools.splice(0, 1);
            
            console.log(`🔄 [DYNAMIC-TOOLS] Retrying with ${currentTools.length} remaining tools...`);
            return this.sendChatWithDynamicToolRemoval(model, messages, options, currentTools, attempt + 1);
          } else {
            // No tools left, send without tools
            console.warn(`⚠️ [DYNAMIC-TOOLS] No tools left, sending without tools`);
            return this.sendChatWithDynamicToolRemoval(model, messages, options, undefined, attempt + 1);
          }
        }
      } else if (isToolValidationError && (!currentTools || currentTools.length === 0)) {
        console.warn(`⚠️ [DYNAMIC-TOOLS] Tool validation error but no tools to remove, sending without tools`);
        // Send without tools
        return this.sendChatWithDynamicToolRemoval(model, messages, options, undefined, attempt + 1);
      } else {
        // Not a tool validation error, re-throw the error
        throw error;
      }
    }
  }

  /**
   * Stream a chat response with dynamic tool removal on validation errors
   */
  private async *streamChatWithDynamicToolRemoval(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {},
    tools?: Tool[],
    attempt: number = 1
  ): AsyncGenerator<APIResponse> {
    // No limit on attempts - keep trying until all problematic tools are removed
    let currentTools = tools ? [...tools] : undefined;
    
    // Filter out known problematic tools before starting
    if (currentTools && currentTools.length > 0) {
      const originalCount = currentTools.length;
      currentTools = this.filterOutProblematicTools(currentTools);
      if (currentTools.length < originalCount) {
        console.log(`🔧 [DYNAMIC-TOOLS-STREAM] Filtered out ${originalCount - currentTools.length} known problematic tools, ${currentTools.length} remaining`);
      }
    }
    
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    const formattedTools = currentTools?.map(tool => this.formatTool(tool));
    
    const payload = { 
      model, 
      messages: this.prepareMessages(messages), 
      stream: true,
      ...options 
    };

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      console.log(`🔧 [DYNAMIC-TOOLS-STREAM] Attempt ${attempt}: Sending stream request with ${formattedTools?.length || 0} tools`);
      
      const streamResponse = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal
      });

      if (!streamResponse.ok) {
        // Try to parse JSON error response
        let errorMessage = `Stream request failed: ${streamResponse.status} ${streamResponse.statusText}`;
        let errorData: any = null;
        
        try {
          errorData = await streamResponse.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If JSON parsing fails, use original error message
        }
        
        // Check if this is a tool validation error
        const isToolValidationError = this.isOpenAIToolValidationError({ message: errorMessage, errorData });
        
        if (isToolValidationError && currentTools && currentTools.length > 0) {
          const problematicToolIndex = this.extractProblematicToolIndex({ message: errorMessage, errorData });
          
          if (problematicToolIndex !== null && problematicToolIndex < currentTools.length) {
            const removedTool = currentTools[problematicToolIndex];
            console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Removing problematic tool at index ${problematicToolIndex}: ${removedTool.name}`);
            console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Error details:`, errorMessage);
            
            // Store the problematic tool so it won't be loaded again
            this.storeProblematicTool(removedTool, errorMessage);
            
            // Remove the problematic tool
            currentTools.splice(problematicToolIndex, 1);
            
            // Retry with remaining tools
            console.log(`🔄 [DYNAMIC-TOOLS-STREAM] Retrying with ${currentTools.length} remaining tools...`);
            yield* this.streamChatWithDynamicToolRemoval(model, messages, options, currentTools, attempt + 1);
            return;
          } else {
            console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Could not identify problematic tool index from error`);
            
            // If we can't identify the specific tool, remove the first tool and try again
            if (currentTools.length > 0) {
              const removedTool = currentTools[0];
              console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Removing first tool as fallback: ${removedTool.name}`);
              this.storeProblematicTool(removedTool, errorMessage);
              currentTools.splice(0, 1);
              
              console.log(`🔄 [DYNAMIC-TOOLS-STREAM] Retrying with ${currentTools.length} remaining tools...`);
              yield* this.streamChatWithDynamicToolRemoval(model, messages, options, currentTools, attempt + 1);
              return;
            } else {
              // No tools left, send without tools
              console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] No tools left, sending without tools`);
              yield* this.streamChatWithDynamicToolRemoval(model, messages, options, undefined, attempt + 1);
              return;
            }
          }
        } else if (isToolValidationError && (!currentTools || currentTools.length === 0)) {
          console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Tool validation error but no tools to remove, sending without tools`);
          // Send without tools
          yield* this.streamChatWithDynamicToolRemoval(model, messages, options, undefined, attempt + 1);
          return;
        } else {
          // Not a tool validation error, throw the error
          const error = new Error(errorMessage);
          (error as any).status = streamResponse.status;
          (error as any).errorData = errorData;
          throw error;
        }
      }

      console.log(`✅ [DYNAMIC-TOOLS-STREAM] Stream request successful on attempt ${attempt}`);

      if (!streamResponse.body) throw new Error("No response body");

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || line === 'data: [DONE]') continue;
          
          try {
            const parsed = JSON.parse(line.replace('data: ', ''));
            
            // Check for error in streaming response
            if (parsed.error) {
              const error = new Error(parsed.error.message || 'Streaming error');
              (error as any).errorData = parsed.error;
              throw error;
            }
            
            const choice = parsed.choices?.[0];
            
            if (choice) {
              const data: APIResponse = {
                message: {
                  content: choice.delta?.content || '',
                  role: choice.delta?.role || 'assistant',
                  tool_calls: choice.delta?.tool_calls
                },
                finish_reason: choice.finish_reason,
                usage: parsed.usage
              };
              
              yield data;
            }
          } catch (e) {
            // If it's a parsing error, just warn and continue
            if (e instanceof SyntaxError) {
              console.warn('Failed to parse streaming response line:', line, e);
            } else {
              // If it's our custom error (like tools+stream error), re-throw it
              throw e;
            }
          }
        }
      }
    } catch (error: any) {
      // Check if this is an OpenAI tool validation error that occurred during streaming
      const isToolValidationError = this.isOpenAIToolValidationError(error);
      
      if (isToolValidationError && currentTools && currentTools.length > 0) {
        const problematicToolIndex = this.extractProblematicToolIndex(error);
        
        if (problematicToolIndex !== null && problematicToolIndex < currentTools.length) {
          const removedTool = currentTools[problematicToolIndex];
          console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Removing problematic tool at index ${problematicToolIndex}: ${removedTool.name}`);
          console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Error details:`, error.message);
          
          // Remove the problematic tool
          currentTools.splice(problematicToolIndex, 1);
          
          // Retry with remaining tools
          console.log(`🔄 [DYNAMIC-TOOLS-STREAM] Retrying with ${currentTools.length} remaining tools...`);
          yield* this.streamChatWithDynamicToolRemoval(model, messages, options, currentTools, attempt + 1);
          return;
        } else {
          console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Could not identify problematic tool index from error, removing all tools`);
          // If we can't identify the specific tool, try without any tools
          yield* this.streamChatWithDynamicToolRemoval(model, messages, options, undefined, attempt + 1);
          return;
        }
      } else if (isToolValidationError && currentTools && currentTools.length > 0) {
        console.warn(`⚠️ [DYNAMIC-TOOLS-STREAM] Max attempts reached, sending without tools`);
        // Max attempts reached, send without tools
        yield* this.streamChatWithDynamicToolRemoval(model, messages, options, undefined, attempt + 1);
        return;
      } else {
        // Not a tool validation error or no tools to remove, re-throw the error
        throw error;
      }
    } finally {
      if (this.abortController) {
        this.abortController = null;
      }
    }
  }

  /**
   * Check if an error is an OpenAI tool validation error
   */
  private isOpenAIToolValidationError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || '';
    const errorData = error.errorData || {};
    
    console.log(`🔍 [ERROR-CHECK] Checking error:`, {
      message,
      errorDataExists: !!errorData,
      errorCode: errorData?.error?.code,
      errorType: errorData?.error?.type,
      errorParam: errorData?.error?.param
    });
    
    // Check for OpenAI function parameter validation errors
    const isValidationError = (
      message.includes('Invalid schema for function') ||
      message.includes('array schema missing items') ||
      message.includes('invalid_function_parameters') ||
      errorData?.error?.code === 'invalid_function_parameters' ||
      errorData?.error?.type === 'invalid_request_error'
    );
    
    console.log(`🔍 [ERROR-CHECK] Is validation error:`, isValidationError);
    return isValidationError;
  }

  /**
   * Extract the problematic tool index from OpenAI error message
   */
  private extractProblematicToolIndex(error: any): number | null {
    if (!error) return null;
    
    const message = error.message || '';
    const errorData = error.errorData || {};
    
    console.log(`🔍 [INDEX-EXTRACT] Extracting from:`, {
      message,
      errorParam: errorData?.error?.param,
      fullErrorData: errorData
    });
    
    // Look for patterns like "tools[9].function.parameters"
    const toolIndexMatch = message.match(/tools\[(\d+)\]/);
    if (toolIndexMatch) {
      const index = parseInt(toolIndexMatch[1], 10);
      console.log(`🔍 [DYNAMIC-TOOLS] Extracted tool index ${index} from error message: ${message}`);
      return index;
    }
    
    // Also check in errorData.error.param
    if (errorData?.error?.param) {
      const paramMatch = errorData.error.param.match(/tools\[(\d+)\]/);
      if (paramMatch) {
        const index = parseInt(paramMatch[1], 10);
        console.log(`🔍 [DYNAMIC-TOOLS] Extracted tool index ${index} from error param: ${errorData.error.param}`);
        return index;
      }
    }
    
    console.warn(`⚠️ [DYNAMIC-TOOLS] Could not extract tool index from error:`, { message, errorData });
    return null;
  }

  /**
   * Generate a completion that includes images
   */
  public async generateWithImages(
    model: string,
    prompt: string,
    images: string[],
    options: RequestOptions = {}
  ): Promise<any> {
    const formattedContent = [
      {
        type: "text",
        text: prompt
      },
      ...images.map(img => ({
        type: "image_url",
        image_url: {
          url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
        }
      }))
    ];

    const messages = [
      {
        role: "user",
        content: formattedContent
      }
    ];

    const response = await this.request("/chat/completions", "POST", {
      model,
      messages,
      max_tokens: options.max_tokens || 1000,
      ...options
    });

    if (!response.choices?.[0]?.message) {
      throw new Error('Invalid response format from image generation');
    }

    return {
      response: response.choices[0].message.content,
      eval_count: response.usage?.total_tokens || 0
    };
  }

  /**
   * Helper to prepare messages for API format
   */
  private prepareMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => {
      if (msg.images?.length) {
        // Format message with images
        const content = [
          { type: "text", text: msg.content },
          ...msg.images.map(img => ({
            type: "image_url",
            image_url: {
              url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
            }
          }))
        ];
        return { role: msg.role, content };
      }
      return msg;
    });
  }

  /**
   * Generate embeddings from a model.
   */
  public async generateEmbeddings(
    model: string,
    input: string | string[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { 
      model, 
      input: Array.isArray(input) ? input : [input], 
      ...options 
    };
    
    return this.request('/embeddings', "POST", payload);
  }

  /**
   * Check connection to the API
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch (error) {
      console.error('Error checking API connection:', error);
      return false;
    }
  }

  /**
   * Format tools for OpenAI-compatible API
   */
  private formatTool(tool: Tool): any {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce((acc: any, param: any) => ({
            ...acc,
            [param.name]: {
              type: param.type.toLowerCase(),
              description: param.description
            }
          }), {}),
          required: tool.parameters
            .filter((p: any) => p.required)
            .map((p: any) => p.name)
        }
      }
    };
  }

  /**
   * Store a problematic tool so it won't be loaded again
   */
  private storeProblematicTool(tool: Tool, errorMessage: string): void {
    const toolKey = `${tool.name}:${tool.description}`;
    APIClient.problematicTools.add(toolKey);
    
    console.log(`🚫 [PROBLEMATIC-TOOLS] Stored problematic tool: ${tool.name}`);
    console.log(`🚫 [PROBLEMATIC-TOOLS] Error: ${errorMessage}`);
    console.log(`🚫 [PROBLEMATIC-TOOLS] Total problematic tools: ${APIClient.problematicTools.size}`);
    
    // Also store in localStorage for persistence across sessions
    try {
      const stored = JSON.parse(localStorage.getItem('clara-problematic-tools') || '[]');
      const toolInfo = {
        name: tool.name,
        description: tool.description,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
      
      // Check if already exists
      const exists = stored.some((t: any) => t.name === tool.name && t.description === tool.description);
      if (!exists) {
        stored.push(toolInfo);
        localStorage.setItem('clara-problematic-tools', JSON.stringify(stored));
        console.log(`💾 [PROBLEMATIC-TOOLS] Persisted to localStorage`);
      }
    } catch (error) {
      console.warn('Failed to store problematic tool in localStorage:', error);
    }
  }

  /**
   * Filter out known problematic tools
   */
  private filterOutProblematicTools(tools: Tool[]): Tool[] {
    // Load from localStorage on first use
    if (APIClient.problematicTools.size === 0) {
      this.loadProblematicToolsFromStorage();
    }
    
    const filtered = tools.filter(tool => {
      const toolKey = `${tool.name}:${tool.description}`;
      const isProblematic = APIClient.problematicTools.has(toolKey);
      
      if (isProblematic) {
        console.log(`🚫 [FILTER] Skipping known problematic tool: ${tool.name}`);
      }
      
      return !isProblematic;
    });
    
    return filtered;
  }

  /**
   * Load problematic tools from localStorage
   */
  private loadProblematicToolsFromStorage(): void {
    try {
      const stored = JSON.parse(localStorage.getItem('clara-problematic-tools') || '[]');
      for (const toolInfo of stored) {
        const toolKey = `${toolInfo.name}:${toolInfo.description}`;
        APIClient.problematicTools.add(toolKey);
      }
      
      if (stored.length > 0) {
        console.log(`📂 [PROBLEMATIC-TOOLS] Loaded ${stored.length} problematic tools from localStorage`);
      }
    } catch (error) {
      console.warn('Failed to load problematic tools from localStorage:', error);
    }
  }

  /**
   * Clear all stored problematic tools (for debugging/reset)
   */
  public static clearProblematicTools(): void {
    APIClient.problematicTools.clear();
    try {
      localStorage.removeItem('clara-problematic-tools');
      console.log(`🗑️ [PROBLEMATIC-TOOLS] Cleared all stored problematic tools`);
    } catch (error) {
      console.warn('Failed to clear problematic tools from localStorage:', error);
    }
  }

  /**
   * Get list of problematic tools (for debugging)
   */
  public static getProblematicTools(): string[] {
    return Array.from(APIClient.problematicTools);
  }

  /**
   * Stream a chat response with optional tools.
   */
  public async *streamChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {},
    tools?: Tool[]
  ): AsyncGenerator<APIResponse> {
    yield* this.streamChatWithDynamicToolRemoval(model, messages, options, tools);
  }
} 