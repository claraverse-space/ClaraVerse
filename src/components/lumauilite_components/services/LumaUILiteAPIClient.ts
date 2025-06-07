export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_calls?: any[];
  name?: string;
  tool_call_id?: string;
}

export interface RequestOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: any[];
  [key: string]: any;
}

export interface LumaUILiteAPIConfig {
  apiKey: string;
  baseUrl: string;
  providerId?: string;
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
    finish_reason?: string;
  }];
  finish_reason?: string;
  usage?: {
    total_tokens: number;
    completion_tokens?: number;
    prompt_tokens?: number;
  };
}

export default class LumaUILiteAPIClient {
  private abortController: AbortController | null = null;
  private config: LumaUILiteAPIConfig;

  constructor(baseUrl: string, config?: Partial<LumaUILiteAPIConfig>) {
    this.config = {
      apiKey: config?.apiKey || '',
      baseUrl: baseUrl,
      providerId: config?.providerId
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<LumaUILiteAPIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Helper for making API requests
   */
  private async request(endpoint: string, method: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    };

    if (this.abortController) {
      fetchOptions.signal = this.abortController.signal;
    }

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, fetchOptions);

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        console.warn('Failed to parse error response:', parseError);
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
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
      
      if (Array.isArray(response?.data)) {
        return response.data.map((model: any) => ({
          name: model.id,
          id: model.id,
          created: model.created?.toString() || ''
        }));
      } else if (Array.isArray(response)) {
        return response.map((model: any) => ({
          name: model.id || model.name,
          id: model.id || model.name,
          created: model.created?.toString() || ''
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
   * Send chat message to AI
   */
  public async sendChat(
    model: string,
    messages: ChatMessage[],
    options: RequestOptions = {}
  ): Promise<APIResponse> {
    try {
      this.abortController = new AbortController();

      const requestBody: any = {
        model,
        messages: this.prepareMessages(messages),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 16000,
        top_p: options.top_p ?? 0.9,
        frequency_penalty: options.frequency_penalty ?? 0,
        presence_penalty: options.presence_penalty ?? 0,
        ...options
      };

      // Add tools if provided
      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
        requestBody.tool_choice = "auto";
      }

      const response = await this.request('/chat/completions', 'POST', requestBody);

      // Handle different response formats
      if (response.choices && response.choices[0]) {
        return {
          message: {
            content: response.choices[0].message.content || '',
            role: response.choices[0].message.role,
            tool_calls: response.choices[0].message.tool_calls
          },
          finish_reason: response.choices[0].finish_reason,
          usage: response.usage
        };
      } else if (response.message) {
        return response;
      } else {
        throw new Error('Unexpected response format from API');
      }
    } catch (error) {
      console.error('Error in sendChat:', error);
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Abort any ongoing requests
   */
  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if the API is processing a request
   */
  public isProcessing(): boolean {
    return this.abortController !== null;
  }

  /**
   * Check connection to the API
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }

  /**
   * Prepare messages for API request
   */
  private prepareMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => {
      const prepared: any = {
        role: msg.role,
        content: msg.content
      };

      if (msg.tool_calls) {
        prepared.tool_calls = msg.tool_calls;
      }

      if (msg.tool_call_id) {
        prepared.tool_call_id = msg.tool_call_id;
      }

      if (msg.name) {
        prepared.name = msg.name;
      }

      return prepared;
    });
  }
} 