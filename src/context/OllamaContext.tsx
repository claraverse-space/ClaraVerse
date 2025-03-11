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

const OllamaContext = createContext<OllamaContextType>({
  baseUrl: 'http://localhost:11434',
  setBaseUrl: () => {},
  client: null,
  availableModels: [],
  isLoading: false,
  error: null,
  refreshModels: () => {}
});

export const useOllama = () => useContext(OllamaContext);

export const OllamaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseUrl, setBaseUrl] = useState<string>('http://localhost:11434');
  const [client, setClient] = useState<OllamaClient | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const newClient = new OllamaClient(baseUrl);
    setClient(newClient);
    refreshModels(newClient);
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
