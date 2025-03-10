import { OllamaClient } from './OllamaClient';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses
const createMockResponse = (data: any, ok = true, status = 200) => {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
    body: {
      getReader: () => ({
        read: async () => ({ value: new TextEncoder().encode(JSON.stringify(data)), done: true })
      })
    }
  };
};

describe('OllamaClient', () => {
  let client: OllamaClient;
  
  beforeEach(() => {
    client = new OllamaClient('http://localhost:11434');
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('getVersion', () => {
    it('should return the version from API', async () => {
      const mockVersionResponse = { version: '0.1.14' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockVersionResponse));
      
      const version = await client.getVersion();
      
      expect(version).toBe('0.1.14');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/version', expect.objectContaining({
        mode: 'cors'
      }));
    });
    
    it('should handle CORS errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      
      await expect(client.getVersion()).rejects.toThrow('CORS error');
    });
    
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));
      
      await expect(client.getVersion()).rejects.toThrow('CORS error: Unable to connect to Ollama server');
    });
  });
  
  describe('listModels', () => {
    it('should return list of models', async () => {
      const mockModelsResponse = {
        models: [
          { name: 'llama2', digest: 'abc123' },
          { name: 'mistral', digest: 'def456' }
        ]
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockModelsResponse));
      
      const models = await client.listModels();
      
      expect(models).toEqual(mockModelsResponse.models);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.any(Object));
    });
  });
  
  describe('generateCompletion', () => {
    it('should generate a completion from the API', async () => {
      const mockCompletionResponse = {
        model: 'llama2',
        response: 'This is a test response',
        done: true
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCompletionResponse));
      
      const result = await client.generateCompletion('llama2', 'Hello, how are you?');
      
      expect(result).toEqual(mockCompletionResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'llama2',
            prompt: 'Hello, how are you?',
            stream: false
          })
        })
      );
    });
  });
  
  describe('abortStream', () => {
    it('should abort the active stream', async () => {
      // Setup a mock AbortController
      const mockAbort = vi.fn();
      const mockAbortController = {
        signal: 'mock-signal',
        abort: mockAbort
      };
      
      // Replace the global AbortController with our mock
      const originalAbortController = global.AbortController;
      global.AbortController = vi.fn().mockImplementation(() => mockAbortController) as any;
      
      try {
        // Create a streaming request that will set the abortController
        const mockStreamResponse = { response: 'test', done: false };
        mockFetch.mockResolvedValueOnce(createMockResponse(mockStreamResponse));
        
        // Start a streaming request - we need to actually access the generator
        const generator = client.streamCompletion('llama2', 'test prompt');
        
        // Force the generator to start executing
        const promise = generator.next();
        
        // Now abort the stream - this should call AbortController.abort()
        client.abortStream();
        
        // Verify abort was called
        expect(mockAbort).toHaveBeenCalled();
        
        // Clean up by awaiting the promise to avoid unhandled rejections
        await promise.catch(() => {});
      } finally {
        // Restore the original AbortController
        global.AbortController = originalAbortController;
      }
    });
  });
  
  describe('sendChat', () => {
    it('should send a chat message to the API', async () => {
      const mockChatResponse = {
        model: 'llama2',
        message: {
          role: 'assistant',
          content: 'I am an AI assistant.'
        },
        done: true
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockChatResponse));
      
      const messages = [
        { role: 'user' as const, content: 'Who are you?' }
      ];
      
      const result = await client.sendChat('llama2', messages);
      
      expect(result).toEqual(mockChatResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'llama2',
            messages,
            stream: false
          })
        })
      );
    });
  });
  
  describe('generateWithImages', () => {
    it('should send a request with images to the API', async () => {
      const mockImageResponse = {
        model: 'llava',
        response: 'I see a cat in this image',
        done: true
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockImageResponse));
      
      const images = ['base64encodedimage1', 'base64encodedimage2'];
      
      const result = await client.generateWithImages('llava', 'What is in this image?', images);
      
      expect(result).toEqual(mockImageResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'llava',
            prompt: 'What is in this image?',
            images,
            stream: false
          })
        })
      );
    });
  });
});
