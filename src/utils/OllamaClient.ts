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
   * Stream a completion for a given prompt.
   * Returns an async generator that yields JSON objects as they arrive.
   */
  public async *streamCompletion(
    model: string,
    prompt: string,
    options: RequestOptions = {}
  ): AsyncGenerator<any> {
    const payload = { model, prompt, ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: 'cors',
      body: JSON.stringify(payload),
    });

    if (!response.body) throw new Error("No response body for streaming completion");
    yield* this.parseStream(response.body.getReader());
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
    const payload = { model, messages, ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: 'cors',
      body: JSON.stringify(payload),
    });

    if (!response.body) throw new Error("No response body for streaming chat");
    yield* this.parseStream(response.body.getReader());
  }

  /**
   * Generate a completion that includes images.
   * Pass an array of base64-encoded image strings.
   */
  public async generateWithImages(
    model: string,
    prompt: string,
    images: string[],
    options: RequestOptions = {}
  ): Promise<any> {
    const payload = { model, prompt, images, ...options, stream: false };
    return this.request("/api/generate", "POST", payload);
  }

  /**
   * Pull a model from the Ollama library.
   * Optionally, pass insecure or stream parameters.
   */
  public async pullModel(
    model: string,
    insecure: boolean = false,
    stream: boolean = true
  ): Promise<any> {
    const payload = { model, insecure, stream };
    return this.request("/api/pull", "POST", payload);
  }

  /**
   * Utility method: Parses a streaming response.
   * It yields each parsed JSON object as it is received.
   */
  private async *parseStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<any> {
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
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
}
