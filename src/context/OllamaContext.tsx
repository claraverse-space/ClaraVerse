import React, { createContext, useContext, useState, useEffect } from 'react';
import { OllamaClient } from '../utils/OllamaClient';

interface OllamaContextType {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  client: OllamaClient | null;
  availableModels: any[];
  isLoading: boolean;
  error: string | null;
  refreshModels: () => void;
}

const DEFAULT_LOCALHOST_URL = 'http://localhost:11434';
const DEFAULT_DOCKER_URL = 'http://host.docker.internal:11434';

const OllamaContext = createContext<OllamaContextType>({
  baseUrl: DEFAULT_LOCALHOST_URL,
  setBaseUrl: () => {},
  client: null,
  availableModels: [],
  isLoading: false,
  error: null,
  refreshModels: () => {}
});

export const useOllama = () => useContext(OllamaContext);

export const OllamaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_LOCALHOST_URL);
  const [client, setClient] = useState<OllamaClient | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to test Ollama connection
  const testOllamaConnection = async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn(`Failed to connect to Ollama at ${url}:`, error);
      return false;
    }
  };

  // Initialize connection with fallback
  useEffect(() => {
    const initializeConnection = async () => {
      // Try localhost first
      if (await testOllamaConnection(DEFAULT_LOCALHOST_URL)) {
        setBaseUrl(DEFAULT_LOCALHOST_URL);
        const newClient = new OllamaClient(DEFAULT_LOCALHOST_URL);
        setClient(newClient);
        refreshModels(newClient);
      } 
      // Fall back to host.docker.internal
      else {
        console.log('Falling back to host.docker.internal');
        setBaseUrl(DEFAULT_DOCKER_URL);
        const newClient = new OllamaClient(DEFAULT_DOCKER_URL);
        setClient(newClient);
        refreshModels(newClient);
      }
    };

    initializeConnection();
  }, []);

  // Handle manual URL changes
  useEffect(() => {
    if (baseUrl !== DEFAULT_LOCALHOST_URL && baseUrl !== DEFAULT_DOCKER_URL) {
      const newClient = new OllamaClient(baseUrl);
      setClient(newClient);
      refreshModels(newClient);
    }
  }, [baseUrl]);

  const refreshModels = async (clientToUse?: OllamaClient) => {
    const currentClient = clientToUse || client;
    if (!currentClient) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const models = await currentClient.listModels();
      setAvailableModels(models);
    } catch (err) {
      console.error('Failed to fetch Ollama models:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
      setAvailableModels([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OllamaContext.Provider 
      value={{ 
        baseUrl, 
        setBaseUrl, 
        client, 
        availableModels, 
        isLoading, 
        error,
        refreshModels: () => refreshModels()
      }}
    >
      {children}
    </OllamaContext.Provider>
  );
};
