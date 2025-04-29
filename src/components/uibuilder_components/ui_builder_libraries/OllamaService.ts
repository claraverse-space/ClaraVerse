import { OllamaConnection, OllamaGenerationOptions, OllamaModelList, OllamaResponse } from './OllamaTypes';

/**
 * Service to interact with Ollama API
 */
class OllamaService {
  private baseUrl: string;

  constructor(connection: OllamaConnection) {
    const protocol = connection.secure ? 'https' : 'http';
    this.baseUrl = `${protocol}://${connection.host}:${connection.port}`;
  }

  /**
   * Set a new connection for the Ollama service
   */
  setConnection(connection: OllamaConnection) {
    const protocol = connection.secure ? 'https' : 'http';
    this.baseUrl = `${protocol}://${connection.host}:${connection.port}`;
  }

  /**
   * Get the list of available models from Ollama
   */
  async getModels(): Promise<OllamaModelList> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      throw error;
    }
  }

  /**
   * Generate a completion from Ollama
   */
  async generateCompletion(options: OllamaGenerationOptions): Promise<OllamaResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate completion: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error generating completion from Ollama:', error);
      throw error;
    }
  }

  /**
   * Generate a streaming completion from Ollama
   * @param options Generation options
   * @param onChunk Callback function for each chunk received
   * @param onComplete Callback function when stream is complete
   * @param onError Callback function when an error occurs
   */
  async generateCompletionStream(
    options: OllamaGenerationOptions,
    onChunk: (chunk: OllamaResponse) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // Ensure streaming is enabled
      options.stream = true;
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start streaming: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process any remaining data in the buffer
          if (buffer.trim()) {
            try {
              const chunk = JSON.parse(buffer);
              onChunk(chunk);
            } catch (e) {
              console.warn('Error parsing final chunk:', e);
            }
          }
          
          onComplete();
          break;
        }
        
        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete JSON objects from the buffer
        const processBuffer = () => {
          const newlineIndex = buffer.indexOf('\n');
          if (newlineIndex === -1) return false;
          
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          if (line.trim()) {
            try {
              const jsonChunk = JSON.parse(line);
              onChunk(jsonChunk);
            } catch (e) {
              console.warn('Error parsing JSON chunk:', e);
            }
          }
          
          return true;
        };
        
        // Process all complete lines in the buffer
        while (processBuffer()) {
          // Keep processing until no more complete lines
        }
      }
    } catch (error) {
      console.error('Error in streaming completion:', error);
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check if Ollama is reachable
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('Error checking Ollama connection:', error);
      return false;
    }
  }
}

export default OllamaService; 