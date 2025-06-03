import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, Provider } from '../db';

interface ProvidersContextType {
  providers: Provider[];
  primaryProvider: Provider | null;
  loading: boolean;
  addProvider: (provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProvider: (id: string, updates: Partial<Provider>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setPrimaryProvider: (id: string) => Promise<void>;
  refreshProviders: () => Promise<void>;
  customModelPath: string | null;
  setCustomModelPath: (path: string | null) => Promise<void>;
  reloadCustomModelPath: () => Promise<void>;
}

const ProvidersContext = createContext<ProvidersContextType | undefined>(undefined);

export const useProviders = () => {
  const context = useContext(ProvidersContext);
  if (context === undefined) {
    throw new Error('useProviders must be used within a ProvidersProvider');
  }
  return context;
};

interface ProvidersProviderProps {
  children: ReactNode;
}

export const ProvidersProvider: React.FC<ProvidersProviderProps> = ({ children }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [primaryProvider, setPrimaryProviderState] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [customModelPath, setCustomModelPathState] = useState<string | null>(null);

  const reloadCustomModelPath = async () => {
    try {
      const savedPath = await db.getCustomModelPath();
      setCustomModelPathState(savedPath);
      
      // Check if the backend service already has the correct custom path
      if (savedPath && window.llamaSwap) {
        try {
          // Add a small delay to ensure the service is ready
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check current backend paths first
          const currentPaths = await window.llamaSwap.getCustomModelPaths();
          const hasCorrectPath = currentPaths.includes(savedPath);
          
          if (!hasCorrectPath) {
            console.log('Backend missing custom model path, setting it:', savedPath);
            await window.llamaSwap.setCustomModelPath(savedPath);
            // Regenerate config to include models from custom directory
            await window.llamaSwap.regenerateConfig();
          } else {
            console.log('Backend already has correct custom model path:', savedPath);
          }
        } catch (error) {
          console.error('Failed to set custom model path in backend during startup:', error);
          // Retry once after a longer delay
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await window.llamaSwap.setCustomModelPath(savedPath);
            await window.llamaSwap.regenerateConfig();
            console.log('Successfully set custom model path on retry');
          } catch (retryError) {
            console.error('Failed to set custom model path on retry:', retryError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to reload custom model path:', error);
    }
  };

  const setCustomModelPath = async (path: string | null) => {
    try {
      // Save to database
      await db.setCustomModelPath(path);
      setCustomModelPathState(path);
      
      // Update llama-swap service for both setting and clearing
      if (window.llamaSwap) {
        // Backend handles both null (clearing) and string (setting) cases
        await window.llamaSwap.setCustomModelPath(path);
        
        // Regenerate config and restart to apply changes
        await window.llamaSwap.regenerateConfig();
        await window.llamaSwap.restart();
      }
    } catch (error) {
      console.error('Error setting custom model path:', error);
    }
  };

  const refreshProviders = async () => {
    try {
      setLoading(true);
      const allProviders = await db.getAllProviders();
      setProviders(allProviders);
      
      const primary = await db.getPrimaryProvider();
      setPrimaryProviderState(primary);
    } catch (error) {
      console.error('Error refreshing providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProvider = async (provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await db.addProvider(provider);
      await refreshProviders();
      return id;
    } catch (error) {
      console.error('Error adding provider:', error);
      // Re-throw the error so the UI can handle it
      throw error;
    }
  };

  const updateProvider = async (id: string, updates: Partial<Provider>) => {
    await db.updateProvider(id, updates);
    await refreshProviders();
  };

  const deleteProvider = async (id: string) => {
    await db.deleteProvider(id);
    await refreshProviders();
  };

  const setPrimaryProvider = async (id: string) => {
    await db.setPrimaryProvider(id);
    await refreshProviders();
  };

  useEffect(() => {
    const initializeProviders = async () => {
      await db.initializeDefaultProviders();
      await refreshProviders();
      await reloadCustomModelPath();
    };

    initializeProviders();
  }, []);

  const value: ProvidersContextType = {
    providers,
    primaryProvider,
    loading,
    addProvider,
    updateProvider,
    deleteProvider,
    setPrimaryProvider,
    refreshProviders,
    customModelPath,
    setCustomModelPath,
    reloadCustomModelPath
  };

  return (
    <ProvidersContext.Provider value={value}>
      {children}
    </ProvidersContext.Provider>
  );
}; 