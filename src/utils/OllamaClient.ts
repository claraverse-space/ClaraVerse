import { stringify } from "querystring";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  images?: string[];
  tool_calls?: any[];
}

export interface RequestOptions {
  [key: string]: any;
}

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  type: 'ollama' | 'openai';
}

export class OllamaClient {
  private abortController: AbortController | null = null;
  private config: OpenAIConfig;

  constructor(baseUrl: string, config?: Partial<OpenAIConfig>) {
    this.config = {
      apiKey: config?.apiKey || '',
      baseUrl: baseUrl,
      type: config?.type || 'ollama'
    };
  }

  /**
   * Get the current configuration
   */
  public getConfig(): OpenAIConfig {
    return { ...this.config };
  }

  /**
   * Helper for making API requests.
   */
  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "POST",
    body?: any
  ): Promise<T> {
    const isOllamaEndpoint = endpoint.startsWith('/api/');
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.apiKey && !isOllamaEndpoint) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        mode: 'cors',
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        // Format error message including the API response
        const errorMessage = {
          status: response.status,
          statusText: response.statusText,
          apiError: data.error || data,
        };
        throw new Error(JSON.stringify(errorMessage, null, 2));
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        // If it's already a formatted error, re-throw it
        if (error.message.includes('"status":')) {
          throw error;
        }
        // Format connection errors
        if (error.message.includes('Failed to fetch')) {
          throw new Error(JSON.stringify({
            status: 503,
            statusText: 'Connection Error',
            message: `Unable to connect to ${this.config.baseUrl}. Please check if the server is running and the URL is correct.`
          }, null, 2));
        }
        throw error;
      }
      throw new Error(JSON.stringify({
        status: 500,
        statusText: 'Unknown Error',
        message: 'An unknown error occurred while connecting to the API server'
      }, null, 2));
    }
  }

  /**
   * Lists available models
   */
  public async listModels(): Promise<any[]> {
    try {
      // Use consistent OpenAI-style endpoint for Ollama too
      const endpoint = this.config.type === 'ollama' ? '/api/tags' : '/models';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (this.config.type === 'openai' && this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
      
      const url = `${this.config.baseUrl}${endpoint}`;
      const response = await fetch(url, { 
        headers,
        method: 'GET',
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (this.config.type === 'ollama') {
        return data.models || [];
      } else {
        // OpenAI format
        // Check if data.data exists (standard OpenAI and compatible APIs)
        if (Array.isArray(data?.data)) {
          return data.data.map((model: any) => ({
            name: model.id,
            id: model.id,
            digest: model.created?.toString() || '',
            size: 0,
            modified_at: model.created?.toString() || ''
          }));
        } else if (Array.isArray(data)) {
          // Some compatible APIs might return array directly
          return data.map((model: any) => ({
            name: model.id || model.name,
            id: model.id || model.name,
            digest: model.created?.toString() || '',
            size: 0,
            modified_at: model.created?.toString() || ''
          }));
        } else {
          console.warn('Unexpected model list format:', data);
          return [];
        }
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
   * Send a chat message (non-streaming).
   */
  public async sendChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): Promise<any> {
    const endpoint = this.config.type === 'ollama' ? '/api/chat' : '/chat/completions';
    
    const payload = this.config.type === 'ollama' 
      ? { model, messages, ...options, stream: false }
      : { model, messages, stream: false, ...options };

    const response = await this.request(endpoint, "POST", payload);

    // Transform response to a consistent format
    if (this.config.type !== 'ollama') {
      return {
        message: {
          content: response.choices[0].message.content,
          role: response.choices[0].message.role
        },
        eval_count: response.usage?.total_tokens || 0
      };
    }
    
    return response;
  }

  /**
   * Stream a chat response.
   */
  public async *streamChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): AsyncGenerator<any> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    const endpoint = this.config.type === 'ollama' ? '/api/chat' : '/chat/completions';
    const payload = { 
      model, 
      messages: this.prepareMessages(messages), 
      stream: true,
      ...options 
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey && this.config.type !== 'ollama') {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || line === 'data: [DONE]') continue;
          
          try {
            let data;
            if (this.config.type === 'ollama') {
              data = JSON.parse(line);
            } else {
              // Parse OpenAI SSE format
              data = JSON.parse(line.replace('data: ', ''));
              data = {
                message: {
                  content: data.choices[0]?.delta?.content || ''
                },
                eval_count: 1
              };
            }
            yield data;
          } catch (e) {
            console.warn('Failed to parse streaming response:', e);
          }
        }
      }
    } finally {
      if (this.abortController) {
        this.abortController = null;
      }
      if (signal.aborted) {
        console.log("Stream aborted");
      }
    }
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
    try {
      if (this.config.type === 'ollama') {
        // Use Ollama's generate API
        return this.request("/api/generate", "POST", {
          model,
          prompt,
          images,
          stream: false,
          max_tokens: options.max_tokens || 1000,
          ...options
        });
      }
  
      // Structure messages for OpenAI vision API
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
  
      console.log('OpenAI Vision Request:', {
        model,
        messages,
        max_tokens: options.max_tokens || 1000
      });
  
      try {
        const response = await this.request("/chat/completions", "POST", {
          model,
          messages,
          max_tokens: options.max_tokens || 1000,
          ...options
        });
  
        console.log('OpenAI Vision Response:', response);
  
        if (!response.choices?.[0]?.message) {
          throw new Error('Invalid response format from image generation');
        }
  
        return {
          response: response.choices[0].message.content,
          eval_count: response.usage?.total_tokens || 0
        };
      } catch (error) {
        console.error('Vision API Error:', error);
        // Return error in a format that can be displayed in chat
        throw new Error(JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            type: 'vision_api_error'
          }
        }, null, 2));
      }
    } catch (error) {
      console.error('Vision API Error:', error);
      // Return error in a format that can be displayed in chat
      throw new Error(JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          type: 'vision_api_error'
        }
      }, null, 2));
    }
  }

  /**
   * Pull a model from Ollama (Ollama-specific functionality)
   */
  public async *pullModel(
    model: string,
    insecure: boolean = false
  ): AsyncGenerator<{
    status: string;
    digest?: string;
    total?: number;
    completed?: number;
  }> {
    if (this.config.type !== 'ollama') {
      throw new Error('Model pulling is only supported with Ollama');
    }

    const payload = { model, insecure, stream: true };
    const response = await fetch(`${this.config.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentDigest = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.digest && data.digest !== currentDigest) {
                currentDigest = data.digest;
                console.log(`\nStarting new layer: ${currentDigest.slice(0, 12)}...`);
              }
              yield data;
            } catch (error) {
              console.warn('Failed to parse pull response line:', error);
            }
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          yield data;
        } catch (error) {
          console.warn('Failed to parse final pull response buffer:', error);
        }
      }
    } finally {
      reader.cancel();
    }
  }

  /**
   * Helper to prepare messages for OpenAI format if needed
   */
  private prepareMessages(messages: ChatMessage[]): any[] {
    if (this.config.type !== 'ollama') {
      return messages.map(msg => {
        if (msg.images?.length) {
          // Format message with images for OpenAI
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
    return messages;
  }

  /**
   * Generate embeddings from a model.
   */
  public async generateEmbeddings(
    model: string,
    input: string | string[],
    options: RequestOptions = {}
  ): Promise<any> {
    const endpoint = this.config.type === 'ollama' ? '/api/embed' : '/embeddings';
    const payload = this.config.type === 'ollama'
      ? { model, input, ...options }
      : { model, input: Array.isArray(input) ? input : [input], ...options };
    
    return this.request(endpoint, "POST", payload);
  }

  /**
   * Send a chat message with structured output format.
   * This is useful for getting responses in a specific JSON schema.
   */
  public async sendStructuredChat(
    model: string,
    messages: ChatMessage[],
    format: object,
    options: RequestOptions = {}
  ): Promise<any> {
    const endpoint = this.config.type === 'ollama' ? '/api/chat' : '/chat/completions';
    
    let payload;
    if (this.config.type === 'ollama') {
      // Ollama uses format parameter
      payload = { 
        model, 
        messages, 
        format: format, 
        ...options, 
        stream: false 
      };
    } else {
      // OpenAI only supports simple JSON response format (no schema validation)
      let OpenAIformat: any = format;
      OpenAIformat.type = 'json_schema';
    
      payload = { 
        model, 
        messages,
        response_format: { type: "json_object" },
        stream: false, 
        ...options 
      };
      
      // For OpenAI, we need to add schema information in the system prompt

      function expandObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj; // Return as is if not an object
        }
    
        if (Array.isArray(obj)) {
            return obj.map(expandObject); // Recursively expand arrays
        }
    
        let expanded = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                expanded[key] = expandObject(obj[key]); // Recursively expand properties
            }
        }
        return expanded;
    }
    
    let expandedSchema = expandObject(format.properties);
    let schemaString = JSON.stringify(expandedSchema, null, 2);
    console.log('schemaString', schemaString);
    


      const schemaDescription = schemaString;
      console.log('schemaDescription', schemaDescription);




      // Find if there's already a system message to append to
      const systemMessageIndex = messages.findIndex(m => m.role === 'system');
      
      if (systemMessageIndex >= 0) {
        // Append to existing system message
        payload.messages = [...messages];
        payload.messages[systemMessageIndex] = {
          ...payload.messages[systemMessageIndex],
          content: `${payload.messages[systemMessageIndex].content}\n\n${schemaDescription}`
        };
      } else {
        // Add new system message at the beginning
        payload.messages = [
          { role: 'system', content: schemaDescription },
          ...messages
        ];
      }
    }

    const response = await this.request(endpoint, "POST", payload);

    // Transform response to a consistent format
    if (this.config.type !== 'ollama') {
      return {
        message: {
          content: response.choices[0].message.content,
          role: response.choices[0].message.role
        },
        eval_count: response.usage?.total_tokens || 0
      };
    }
    
    return response;
  }
  
  /**
   * Format schema description for inclusion in prompts
   * This converts a JSON schema to a text description for OpenAI
   */
  private formatSchemaForPrompt(schema: any): string {
    try {
      // If this is a full JSON schema with properties
      if (schema.type === 'object' && schema.properties) {
        const fields = Object.entries(schema.properties).map(([key, prop]: [string, any]) => {
          return `- "${key}": ${prop.description || 'No description'} (${prop.type || 'string'})`;
        });

       
        
        return `You must respond with a valid JSON object that matches this schema:
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

The JSON object should include these fields:
${fields.join('\n')}

Your response MUST be a valid JSON object, properly formatted and parsable.`;
      } 
      
      // If it's just a simple object with field descriptions
      else if (typeof schema === 'object') {
        const fields = Object.entries(schema).map(([key, description]) => {
          return `- "${key}": ${description}`;
        });
        
        return `You must respond with a valid JSON object that includes these fields:
${fields.join('\n')}

Your response MUST be a valid JSON object, properly formatted and parsable.`;
      }
      
      // Default case
      return 'You must respond with a valid JSON object.';
    } catch (error) {
      console.warn('Error formatting schema for prompt:', error);
      return 'You must respond with a valid JSON object.';
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Use the list models endpoint to check connection
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Error checking Ollama connection:', error);
      return false;
    }
  }
}
