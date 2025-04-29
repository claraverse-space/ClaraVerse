import { OpenAIModel, OpenAICompletionOptions, OpenAIStreamChunk } from './OpenAITypes';

// API types for OpenAI
export interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Service to interact with OpenAI API
 */
export class OpenAIService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = 'https://api.openai.com/v1', apiKey: string = '') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Set a new base URL for the OpenAI service
   */
  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set a new API key for the OpenAI service
   */
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate a completion from OpenAI
   */
  async generateCompletion(options: OpenAICompletionOptions): Promise<OpenAICompletionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to generate completion: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error generating completion from OpenAI:', error);
      throw error;
    }
  }

  /**
   * Generate a streaming completion from OpenAI
   * @param options Completion options
   * @param onChunk Callback function for each chunk received
   * @param onComplete Callback function when stream is complete
   * @param onError Callback function when an error occurs
   */
  public async generateCompletionStream(
    options: OpenAICompletionOptions,
    onChunk: (chunk: { response: string }) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      // First attempt with temperature
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(options)
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Check if it's a temperature error
          if (errorData.error?.message?.includes('temperature') || 
              errorData.error?.message?.includes('does not support') ||
              response.status === 400) {
            // Retry without temperature
            console.log('Retrying without temperature parameter');
            const { temperature, ...optionsWithoutTemp } = options;
            const retryResponse = await fetch(`${this.baseUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(optionsWithoutTemp)
            });

            if (!retryResponse.ok) {
              throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
            }

            await this.handleStreamResponse(retryResponse, onChunk);
            onComplete?.();
            return;
          }
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        await this.handleStreamResponse(response, onChunk);
        onComplete?.();
      } catch (error) {
        if (error instanceof Error && error.message.includes('temperature')) {
          // If we catch a temperature error, retry without it
          console.log('Caught temperature error, retrying without temperature parameter');
          const { temperature, ...optionsWithoutTemp } = options;
          const retryResponse = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(optionsWithoutTemp)
          });

          if (!retryResponse.ok) {
            throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
          }

          await this.handleStreamResponse(retryResponse, onChunk);
          onComplete?.();
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in streaming completion:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleStreamResponse(
    response: Response,
    onChunk: (chunk: { response: string }) => void
  ) {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(5));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              onChunk({ response: content });
            }
          } catch (e) {
            console.warn('Failed to parse streaming response line:', e);
          }
        }
      }
    }
  }

  /**
   * Check if OpenAI is reachable with the current API key
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Error checking OpenAI connection:', error);
      return false;
    }
  }
}

export default OpenAIService; 