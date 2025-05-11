import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { InterpreterClient, InterpreterMessage, MessageRole, MessageType, MessageFormat, ModelConfig } from '../utils/InterpreterClient';

interface InterpreterContextType {
  isInterpreterMode: boolean;
  setInterpreterMode: (mode: boolean) => void;
  messages: InterpreterMessage[];
  sendMessage: (content: string) => Promise<void>;
  executeCode: (code: string) => Promise<string>;
  resetEnvironment: () => Promise<void>;
  isExecuting: boolean;
  stopExecution: () => void;
  setModelConfig: (config: ModelConfig) => void;
  setModelSelectionMode: (mode: 'auto' | 'manual' | 'smart') => void;
  onPageChange: (page: string) => void;
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onOpenKnowledgeBase: () => void;
  onOpenTools: () => void;
  interpreterClient: InterpreterClient;
}

const InterpreterContext = createContext<InterpreterContextType | undefined>(undefined);

export const InterpreterProvider: React.FC<{ 
  children: React.ReactNode;
  onPageChange?: (page: string) => void;
}> = ({ children, onPageChange: parentOnPageChange }) => {
  const [isInterpreterMode, setInterpreterMode] = useState(false);
  const [messages, setMessages] = useState<InterpreterMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [client] = useState(() => new InterpreterClient());

  const onPageChange = useCallback((page: string) => {
    if (parentOnPageChange) {
      parentOnPageChange(page);
    }
  }, [parentOnPageChange]);

  const onNavigateHome = useCallback(() => {
    setInterpreterMode(false);
    onPageChange('home');
  }, [onPageChange]);

  const onOpenSettings = useCallback(() => {
    // This is a placeholder - implement settings modal if needed
    console.log('Open settings');
  }, []);

  const onOpenKnowledgeBase = useCallback(() => {
    // This is a placeholder - implement knowledge base modal if needed
    console.log('Open knowledge base');
  }, []);

  const onOpenTools = useCallback(() => {
    // This is a placeholder - implement tools modal if needed
    console.log('Open tools');
  }, []);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('clara_interpreter_messages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    } catch (e) {
      console.error('Error loading saved messages:', e);
    }
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('clara_interpreter_messages', JSON.stringify(messages));
    } catch (e) {
      console.error('Error saving messages:', e);
    }
  }, [messages]);

  const stopExecution = useCallback(() => {
    client.stopGeneration();
    setIsExecuting(false);
  }, [client]);

  const sendMessage = useCallback(async (content: string) => {
    try {
      setIsExecuting(true);
      const message: InterpreterMessage = {
        role: 'user',
        type: 'message',
        format: 'text',
        content
      };

      // Get the selected model from localStorage
      const selectedModel = localStorage.getItem('selected_ollama_model');
      
      // Send message and get response with new files
      const { messages: updatedMessages, newFiles } = await client.chat([message], {
        model: selectedModel ? `ollama/${selectedModel}` : undefined
      }, (newMessages) => {
        setMessages([...newMessages]);
      });

      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'computer',
          type: 'error',
          format: 'text',
          content: error instanceof Error ? error.message : 'An unexpected error occurred'
        }
      ]);
    } finally {
      setIsExecuting(false);
    }
  }, [client]);

  const executeCode = useCallback(async (code: string): Promise<string> => {
    try {
      setIsExecuting(true);
      const codeMessage: InterpreterMessage = {
        role: 'user',
        type: 'code',
        format: 'python',
        content: code
      };

      const { messages: result } = await client.chat([codeMessage]);
      const output = result
        .filter((msg: InterpreterMessage) => msg.type === 'console' && msg.format === 'output')
        .map((msg: InterpreterMessage) => msg.content as string)
        .join('');

      return output;
    } catch (error) {
      console.error('Error executing code:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, [client]);

  const resetEnvironment = useCallback(async () => {
    try {
      setIsExecuting(true);
      const resetMessage: InterpreterMessage = {
        role: 'system',
        type: 'command',
        format: 'text',
        content: 'reset environment'
      };

      const { messages } = await client.chat([resetMessage]);
      setMessages([]);
    } catch (error) {
      console.error('Error resetting environment:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, [client]);

  const setModelConfig = useCallback((config: ModelConfig) => {
    client.setModelConfig(config);
  }, [client]);

  const setModelSelectionMode = useCallback((mode: 'auto' | 'manual' | 'smart') => {
    client.setModelSelectionMode(mode);
  }, [client]);

  const value = {
    isInterpreterMode,
    setInterpreterMode,
    messages,
    sendMessage,
    executeCode,
    resetEnvironment,
    isExecuting,
    stopExecution,
    setModelConfig,
    setModelSelectionMode,
    onPageChange,
    onNavigateHome,
    onOpenSettings,
    onOpenKnowledgeBase,
    onOpenTools,
    interpreterClient: client
  };

  return (
    <InterpreterContext.Provider value={value}>
      {children}
    </InterpreterContext.Provider>
  );
};

export const useInterpreter = () => {
  const context = useContext(InterpreterContext);
  if (context === undefined) {
    throw new Error('useInterpreter must be used within an InterpreterProvider');
  }
  return context;
}; 