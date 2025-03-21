import type { ReadableStreamDefaultReader } from 'stream/web';

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

export class OllamaClient {
  private abortController: AbortController | null = null;

  constructor(private baseUrl: string) {}

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
        },
        mode: 'cors',
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 403) {
        throw new Error(`CORS error: Please ensure OLLAMA_ORIGINS environment variable is set correctly on the Ollama server. 
          Add OLLAMA_ORIGINS=* or OLLAMA_ORIGINS=chrome-extension://* to your Ollama configuration.`);
      }

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a CORS error
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          throw new Error(`CORS error: Unable to connect to Ollama server at ${this.baseUrl}. 
            Please check if:
            1. The Ollama server is running
            2. The URL is correct
            3. OLLAMA_ORIGINS environment variable is set on the server
            4. No firewall is blocking the connection`);
        }
        throw error;
      }
      throw new Error('An unknown error occurred while connecting to Ollama server');
    }
  }

  /**
   * Ping the server by retrieving the version.
   */
  public async ping(): Promise<boolean> {
    try {
      await this.getVersion();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the Ollama server version.
   */
  public async getVersion(): Promise<string> {
    try {
      const url = `${this.baseUrl}/api/version`;
      const response = await fetch(url, {
        mode: 'cors'
      });

      if (response.status === 403) {
        throw new Error('CORS error: Please configure OLLAMA_ORIGINS on the server');
      }

      if (!response.ok) {
        throw new Error(`Failed to get version: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.version;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          throw new Error(`CORS error: Unable to connect to Ollama server. Please check server configuration.`);
        }
        throw error;
      }
      throw new Error('Failed to get Ollama version');
    }
  }

  /**
   * List local models.
   */
  public async listModels(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await fetch(url, {
        mode: 'cors'
      });

      if (response.status === 403) {
        throw new Error('CORS error: Please configure OLLAMA_ORIGINS on the server');
      }

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.models;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          throw new Error(`CORS error: Unable to list models. Please check server configuration.`);
        }
        throw error;
      }
      throw new Error('Failed to list models');
    }
  }

  /**
   * Show detailed model information.
   */
  public async showModel(model: string, verbose: boolean = false): Promise<any> {
    return this.request("/api/show", "POST", { model, verbose });
  }

  /**
   * Generate a completion for a given prompt (non-streaming).
   * Options can include additional parameters like "suffix", "options", "stream" (false), etc.
   */
  public async generateCompletion(
    model: string,
    prompt: string,
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, prompt, ...options, stream: false };
    return this.request("/api/generate", "POST", payload);
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
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: 'cors',
      body: JSON.stringify(payload),
      signal,
    });

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
   */
  public async sendChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, messages, ...options, stream: false };
    return this.request("/api/chat", "POST", payload);
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
    
    const payload = { model, messages, ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: 'cors',
      body: JSON.stringify(payload),
      signal,
    });

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
   * Pass an array of base64-encoded image strings.
   */
  public async generateWithImages(
    model: string,
    prompt: string,
    images: string[],
    options: RequestOptions = {},
    customBaseUrl?: string
  ): Promise<any> {
    const baseUrl = customBaseUrl || this.baseUrl;
    
    console.log(`Generating with images using URL: ${baseUrl}`);
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        images,
        stream: false,
        ...options
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Pull a model from the Ollama library.
   * Returns a generator that yields progress updates.
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
    const payload = { model, insecure, stream: true };
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            yield JSON.parse(line);
          } catch (error) {
            console.warn('Failed to parse streaming response line:', error);
          }
        }
      }
    }
    
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer);
      } catch (error) {
        console.warn('Failed to parse final streaming response buffer:', error);
      }
    }
  }

  /* ===================== New Functionalities ===================== */

  /**
   * Generate a completion for a given prompt with structured outputs.
   * The `format` parameter can be a JSON schema or "json" to enable JSON mode.
   */
  public async generateStructuredCompletion(
    model: string,
    prompt: string,
    format: any,
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, prompt, format, ...options, stream: false };
    return this.request("/api/generate", "POST", payload);
  }

  /**
   * Send a chat message with structured outputs.
   * The `format` parameter can be a JSON schema or "json" to enable JSON mode.
   */
  public async sendStructuredChat(
    model: string,
    messages: ChatMessage[],
    format: any,
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, messages, format, ...options, stream: false };
    return this.request("/api/chat", "POST", payload);
  }

  /**
   * Send a chat message with function calling (tools).
   * Pass an array of tool definitions in the `tools` parameter.
   */
  public async sendChatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: any[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, messages, tools, ...options, stream: false };
    return this.request("/api/chat", "POST", payload);
  }

  /**
   * Generate a completion in raw mode (bypassing templating).
   */
  public async generateRaw(
    model: string,
    prompt: string,
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, prompt, raw: true, ...options, stream: false };
    return this.request("/api/generate", "POST", payload);
  }

  /**
   * Send a chat message in raw mode (bypassing templating).
   */
  public async sendRawChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, messages, raw: true, ...options, stream: false };
    return this.request("/api/chat", "POST", payload);
  }

  /**
   * Create a new model.
   * Options can include: from, files, adapters, template, license, system, parameters, messages, quantize.
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
    const payload = { model, ...options };
    return this.request("/api/create", "POST", payload);
  }

  /**
   * Copy an existing model to a new model.
   */
  public async copyModel(source: string, destination: string): Promise<any> {
    const payload = { source, destination };
    return this.request("/api/copy", "POST", payload);
  }

  /**
   * Delete a model.
   */
  public async deleteModel(model: string): Promise<any> {
    const payload = { model };
    return this.request("/api/delete", "DELETE", payload);
  }

  /**
   * Push a model to the Ollama library.
   */
  public async pushModel(
    model: string,
    insecure: boolean = false,
    stream: boolean = true
  ): Promise<any> {
    const payload = { model, insecure, stream };
    return this.request("/api/push", "POST", payload);
  }

  /**
   * Generate embeddings from a model.
   * The input can be a single string or an array of strings.
   */
  public async generateEmbeddings(
    model: string,
    input: string | string[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, input, ...options };
    return this.request("/api/embed", "POST", payload);
  }

  /**
   * List models that are currently loaded into memory.
   */
  public async listRunningModels(): Promise<any[]> {
    const url = `${this.baseUrl}/api/ps`;
    try {
      const response = await fetch(url, {
        mode: 'cors'
      });
      if (response.status === 403) {
        throw new Error('CORS error: Please configure OLLAMA_ORIGINS on the server');
      }
      if (!response.ok) {
        throw new Error(`Failed to list running models: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.models;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          throw new Error(`CORS error: Unable to list running models. Please check server configuration.`);
        }
        throw error;
      }
      throw new Error('Failed to list running models');
    }
  }

  /**
   * Unload a model from memory.
   * For chat models, set isChat to true; otherwise, it will use the generate endpoint.
   */
  public async unloadModel(model: string, isChat: boolean = false): Promise<any> {
    if (isChat) {
      const payload = { model, messages: [], keep_alive: 0 };
      return this.request("/api/chat", "POST", payload);
    } else {
      const payload = { model, keep_alive: 0 };
      return this.request("/api/generate", "POST", payload);
    }
  }
}
