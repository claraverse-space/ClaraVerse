import type { ReadableStreamDefaultReader } from 'stream/web';

// Use the same interface definitions as OllamaClient for direct compatibility
export type ChatRole = "system" | "user" | "assistant" | "tool" | "function";

export interface ChatMessage {
  role: ChatRole;
  content: string | null | Array<{
    type: string;
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
  images?: string[]; // For Ollama compatibility
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface RequestOptions {
  [key: string]: any;
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: object;
  };
}

export interface ImageGenerationParams {
  prompt: string;
  model?: string;
  n?: number;
  size?: "1024x1024" | "1024x1792" | "1792x1024" | "256x256" | "512x512";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  response_format?: "url" | "b64_json";
}

export class OpenAIApiClient {
  private abortController: AbortController | null = null;
  private defaultBaseUrl = "https://api.openai.com/v1";

  constructor(private baseUrl: string, private apiKey?: string) {
    // If baseUrl doesn't look like an OpenAI URL but doesn't have a protocol, assume http://
    if (!baseUrl.startsWith('http') && !baseUrl.includes('openai.com')) {
      this.baseUrl = `http://${baseUrl}`;
    }
    
    // If no API key is provided, check environment variable
    if (!this.apiKey) {
      this.apiKey = process.env.OPENAI_API_KEY || '';
    }
  }
  
  /**
   * Helper for making non-streaming API requests.
   */
  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "POST",
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        mode: 'cors',
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Request failed: ${response.status} ${response.statusText}${
          errorData ? `\n${JSON.stringify(errorData)}` : ''
        }`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a CORS error
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          throw new Error(`CORS error: Unable to connect to OpenAI API at ${this.baseUrl}. 
            Please check if:
            1. The server is running
            2. The URL is correct
            3. CORS headers are properly configured
            4. No firewall is blocking the connection`);
        }
        throw error;
      }
      throw new Error('An unknown error occurred while connecting to OpenAI API');
    }
  }

  /**
   * Ping the server by retrieving the model list to verify API access.
   */
  public async ping(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the version (simulated for OpenAI compatibility with Ollama).
   */
  public async getVersion(): Promise<string> {
    try {
      await this.listModels();
      return "OpenAI API"; // Fake version for compatibility
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          throw new Error(`CORS error: Unable to connect to OpenAI API. Please check configuration.`);
        }
        throw error;
      }
      throw new Error('Failed to get OpenAI API version');
    }
  }

  /**
   * List available models.
   */
  public async listModels(): Promise<any[]> {
    try {
      const data = await this.request<{data: any[]}>("/models", "GET");
      
      // Transform OpenAI model format to look like Ollama's format
      return data.data.map(model => ({
        name: model.id,
        // Add fields that Ollama would have
        digest: model.id,
        size: 0,
        modified_at: model.created * 1000, // Convert seconds to milliseconds
        object: model.object
      }));
    } catch (error) {
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Show detailed model information.
   */
  public async showModel(model: string, verbose: boolean = false): Promise<any> {
    try {
      const url = `/models/${encodeURIComponent(model)}`;
      const modelInfo = await this.request(url, "GET");
      
      // Transform to match Ollama's format
      return {
        model,
        // Add any other fields needed for compatibility
        digest: model,
        details: verbose ? modelInfo : undefined
      };
    } catch (error) {
      throw new Error(`Failed to show model: ${error instanceof Error ? error.message : error}`);
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
   * Utility method: Parses a streaming response.
   * It yields each parsed JSON object as it is received.
   */
  private async *parseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal?: AbortSignal
  ): AsyncGenerator<any> {
    const decoder = new TextDecoder();
    let buffer = "";
    
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Stream aborted by user', 'AbortError');
      }
      
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // OpenAI SSE format uses "data: " prefix for each message
      const chunks = buffer.split('\n');
      buffer = "";

      for (const chunk of chunks) {
        if (chunk.startsWith('data: ')) {
          const content = chunk.substring(6);
          if (content === '[DONE]') {
            return;
          }
          
          try {
            const parsed = JSON.parse(content);
            
            // Transform OpenAI format to match Ollama's format for compatibility
            if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              let transformedData: any = {};
              
              if (choice.delta && choice.delta.content) {
                // For streaming chat completions
                transformedData = {
                  message: {
                    content: choice.delta.content
                  },
                  eval_count: parsed.usage?.completion_tokens || 0,
                  done: parsed.choices.every((c: any) => c.finish_reason !== null)
                };
              } else if (choice.text) {
                // For streaming text completions
                transformedData = {
                  response: choice.text,
                  eval_count: parsed.usage?.completion_tokens || 0,
                  done: parsed.choices.every((c: any) => c.finish_reason !== null)
                };
              } else {
                // Default pass-through
                transformedData = parsed;
              }
              
              yield transformedData;
            } else {
              yield parsed;
            }
          } catch (error) {
            console.warn('Failed to parse streaming response line:', error);
          }
        } else if (chunk) {
          buffer += chunk + '\n';
        }
      }
    }
  }

  /**
   * Generate a completion for a given prompt (non-streaming).
   * Methods named after Ollama's API for compatibility
   */
  public async generateCompletion(
    model: string,
    prompt: string,
    options: RequestOptions = {}
  ): Promise<any> {
    try {
      const payload = { model, prompt: prompt, ...options, stream: false };
      const response = await this.request("/completions", "POST", payload);
      
      // Transform OpenAI's response to match Ollama's format
      return {
        model,
        response: response.choices[0].text,
        done: true,
        context: [],
        total_duration: 0,
        load_duration: 0,
        eval_count: response.usage.completion_tokens,
        eval_duration: 0
      };
    } catch (error) {
      throw new Error(`Failed to generate completion: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Stream a completion for a given prompt.
   * Returns an async generator that yields JSON objects as they arrive.
   */
  public async *streamCompletion(
    model: string,
    prompt: string,
    options: RequestOptions = {}
  ): AsyncGenerator<any> {
    // Create a new AbortController for this stream
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    const payload = { model, prompt, ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      mode: 'cors',
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    if (!response.body) throw new Error("No response body for streaming completion");
    
    try {
      yield* this.parseStream(response.body.getReader(), signal);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Stream aborted");
      } else {
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Send a chat message (non-streaming).
   * Named to match Ollama's method for compatibility
   */
  public async sendChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): Promise<any> {
    try {
      // Handle Ollama-style messages with images array
      const transformedMessages = messages.map(msg => {
        if (msg.images && msg.images.length > 0) {
          // Transform to OpenAI multimodal format
          return {
            role: msg.role,
            content: this.transformContentWithImages(msg.content as string, msg.images)
          };
        }
        return msg;
      });
      
      const payload = { model, messages: transformedMessages, ...options, stream: false };
      const response = await this.request("/chat/completions", "POST", payload);
      
      // Transform OpenAI's response to match Ollama's format
      return {
        model,
        message: {
          role: "assistant",
          content: response.choices[0].message.content
        },
        done: true,
        total_duration: 0,
        load_duration: 0,
        eval_count: response.usage.completion_tokens,
        eval_duration: 0,
        prompt_eval_count: response.usage.prompt_tokens,
        prompt_eval_duration: 0
      };
    } catch (error) {
      throw new Error(`Failed to send chat: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Stream a chat response.
   * Returns an async generator that yields JSON objects as they arrive.
   */
  public async *streamChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): AsyncGenerator<any> {
    // Create a new AbortController for this stream
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    // Handle Ollama-style messages with images array
    const transformedMessages = messages.map(msg => {
      if (msg.images && msg.images.length > 0) {
        // Transform to OpenAI multimodal format
        return {
          role: msg.role,
          content: this.transformContentWithImages(msg.content as string, msg.images)
        };
      }
      return msg;
    });
    
    const payload = { model, messages: transformedMessages, ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      mode: 'cors',
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    if (!response.body) throw new Error("No response body for streaming chat");
    
    try {
      yield* this.parseStream(response.body.getReader(), signal);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Stream aborted");
      } else {
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Generate a completion that includes images.
   * Adaptation of Ollama's method for OpenAI compatibility
   */
  public async generateWithImages(
    model: string,
    prompt: string,
    images: string[],
    options: RequestOptions = {},
    customBaseUrl?: string
  ): Promise<any> {
    try {
      const baseUrl = customBaseUrl || this.baseUrl;
      
      // Create OpenAI-style multimodal message
      const messages = [
        {
          role: "user",
          content: this.transformContentWithImages(prompt, images)
        }
      ];
      
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          ...options
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const data = await response.json();
      
      // Transform to match Ollama's response format
      return {
        model,
        response: data.choices[0].message.content,
        done: true,
        total_duration: 0,
        eval_count: data.usage.completion_tokens,
      };
    } catch (error) {
      throw new Error(`Failed to generate with images: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Pull a model from the library.
   * This is simulated for OpenAI compatibility with Ollama.
   * For OpenAI, this is a no-op that reports success since models are cloud-based.
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
    // Simulate progress updates
    yield { status: "pulling model", digest: model };
    yield { status: "verifying model", digest: model };
    yield { 
      status: "downloading", 
      digest: model,
      total: 100,
      completed: 50
    };
    yield { 
      status: "downloading", 
      digest: model,
      total: 100,
      completed: 100
    };
    yield { status: "success", digest: model };
  }

  /* ===================== Additional Compatibility Methods ===================== */

  /**
   * Generate a completion for a given prompt with structured outputs.
   * Compatible with Ollama's version.
   */
  public async generateStructuredCompletion(
    model: string,
    prompt: string,
    format: any,
    options: RequestOptions = {}
  ): Promise<any> {
    // For JSON mode in OpenAI
    const payload = { 
      model, 
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      ...options, 
      stream: false 
    };
    
    const response = await this.request("/chat/completions", "POST", payload);
    
    // Transform to match Ollama's format
    return {
      model,
      response: response.choices[0].message.content,
      done: true,
      total_duration: 0,
      eval_count: response.usage.completion_tokens,
    };
  }

  /**
   * Send a chat message with structured outputs.
   * Compatible with Ollama's version.
   */
  public async sendStructuredChat(
    model: string,
    messages: ChatMessage[],
    format: any,
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { 
      model, 
      messages, 
      response_format: { type: "json_object" },
      ...options, 
      stream: false 
    };
    
    const response = await this.request("/chat/completions", "POST", payload);
    
    // Transform to match Ollama's format
    return {
      model,
      message: {
        role: "assistant",
        content: response.choices[0].message.content
      },
      done: true,
      eval_count: response.usage.completion_tokens,
    };
  }

  /**
   * Send a chat message with function calling (tools).
   * Compatible with Ollama's version.
   */
  public async sendChatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: Tool[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, messages, tools, ...options, stream: false };
    const response = await this.request("/chat/completions", "POST", payload);
    
    // Transform to match Ollama's expected format
    return {
      model,
      message: response.choices[0].message,
      done: true,
      eval_count: response.usage.completion_tokens,
    };
  }

  /**
   * Generate a completion in raw mode.
   * Simulated for OpenAI (which doesn't have the same concept)
   */
  public async generateRaw(
    model: string,
    prompt: string,
    options: RequestOptions = {}
  ): Promise<any> {
    // Just use regular completion for OpenAI
    return this.generateCompletion(model, prompt, options);
  }

  /**
   * Send a chat message in raw mode.
   * Simulated for OpenAI (which doesn't have the same concept)
   */
  public async sendRawChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): Promise<any> {
    // Just use regular chat for OpenAI
    return this.sendChat(model, messages, options);
  }

  /**
   * Create a new model.
   * Simulated for OpenAI API compatibility with Ollama.
   * OpenAI doesn't support creating models via API, so this returns an error.
   */
  public async createModel(
    model: string,
    options: {
      from?: string;
      files?: { [key: string]: string };
      adapters?: { [key: string]: string };
      template?: string;
      license?: string | string[];
      system?: string;
      parameters?: { [key: string]: any };
      messages?: ChatMessage[];
      quantize?: string;
    } = {}
  ): Promise<any> {
    throw new Error("Creating models is not supported in OpenAI API.");
  }

  /**
   * Copy an existing model to a new model.
   * Simulated for OpenAI API compatibility with Ollama.
   * OpenAI doesn't support copying models, so this returns an error.
   */
  public async copyModel(source: string, destination: string): Promise<any> {
    throw new Error("Copying models is not supported in OpenAI API.");
  }

  /**
   * Delete a model.
   * Simulated for OpenAI API compatibility with Ollama.
   * OpenAI doesn't support deleting models via API, so this returns an error.
   */
  public async deleteModel(model: string): Promise<any> {
    // For fine-tuned models, OpenAI does have a delete endpoint
    if (model.startsWith('ft:')) {
      try {
        return this.request(`/models/${model}`, "DELETE");
      } catch (error) {
        throw new Error(`Failed to delete model: ${error instanceof Error ? error.message : error}`);
      }
    }
    throw new Error("Deleting models is not supported in OpenAI API for non-fine-tuned models.");
  }

  /**
   * Push a model to the library.
   * Simulated for OpenAI API compatibility with Ollama.
   * OpenAI doesn't support pushing models, so this returns an error.
   */
  public async pushModel(
    model: string,
    insecure: boolean = false,
    stream: boolean = true
  ): Promise<any> {
    throw new Error("Pushing models is not supported in OpenAI API.");
  }

  /**
   * Generate embeddings from a model.
   * Compatible with Ollama's version.
   */
  public async generateEmbeddings(
    model: string,
    input: string | string[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, input, ...options };
    const response = await this.request("/embeddings", "POST", payload);
    
    // Transform to match Ollama's format
    return {
      embedding: response.data[0].embedding,
      usage: response.usage
    };
  }

  /**
   * List models that are currently loaded into memory.
   * Simulated for OpenAI API compatibility with Ollama.
   * OpenAI doesn't have this concept, so it returns the model list.
   */
  public async listRunningModels(): Promise<any[]> {
    return this.listModels();
  }

  /**
   * Unload a model from memory.
   * Simulated for OpenAI API compatibility with Ollama.
   * OpenAI doesn't have this concept, so it's a no-op.
   */
  public async unloadModel(model: string, isChat: boolean = false): Promise<any> {
    return { success: true, unloaded: model };
  }

  /* ===================== Utility Methods ===================== */

  /**
   * Transform text content and images into OpenAI's multimodal format
   */
  private transformContentWithImages(text: string, images: string[]): any[] {
    const content: any[] = [];
    
    // Add text part
    if (text) {
      content.push({
        type: "text",
        text: text
      });
    }
    
    // Add image parts
    for (const image of images) {
      // Handle both data URLs and base64 strings
      let imageUrl;
      if (image.startsWith('data:')) {
        imageUrl = image;
      } else {
        imageUrl = `data:image/jpeg;base64,${image}`;
      }
      
      content.push({
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      });
    }
    
    return content;
  }
}
