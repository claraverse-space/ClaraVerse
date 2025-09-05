/**
 * Hook for automatically starting Clara Core when notebooks require it
 * Enhanced with container update checking capabilities
 */

import { useEffect, useState, useCallback } from 'react';
import { NotebookResponse } from '../services/claraNotebookService';

interface ClaraCoreStatus {
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;
  serviceName: string | null;
  phase: string | null;
  updateAvailable?: boolean;
  updateChecking?: boolean;
  updateError?: string | null;
}

export const useClaraCoreAutostart = (notebook: NotebookResponse | null) => {
  const [status, setStatus] = useState<ClaraCoreStatus>({
    isRunning: false,
    isStarting: false,
    error: null,
    serviceName: null,
    phase: null,
    updateAvailable: false,
    updateChecking: false,
    updateError: null
  });

  // Check if notebook requires Clara Core
  const requiresClaraCore = useCallback((notebook: NotebookResponse | null): boolean => {
    if (!notebook) return false;
    
    // Check if either LLM or embedding provider uses Clara Core
    // Note: The notebook service might store this differently than the main app
    const llmUsesClaraCore = (notebook.llm_provider?.type as any) === 'claras-pocket' || 
                            notebook.llm_provider?.name?.toLowerCase().includes('clara') ||
                            notebook.llm_provider?.name?.toLowerCase().includes('pocket') ||
                            notebook.llm_provider?.baseUrl?.includes('localhost');
    
    const embeddingUsesClaraCore = (notebook.embedding_provider?.type as any) === 'claras-pocket' || 
                                  notebook.embedding_provider?.name?.toLowerCase().includes('clara') ||
                                  notebook.embedding_provider?.name?.toLowerCase().includes('pocket') ||
                                  notebook.embedding_provider?.baseUrl?.includes('localhost');
    
    return Boolean(llmUsesClaraCore || embeddingUsesClaraCore);
  }, []);

  // Check for container updates
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    try {
      const docker = (window as any).docker;
      if (!docker) {
        console.warn('📦 useClaraCoreAutostart: Docker service not available for update check');
        return false;
      }

      console.log('📦 useClaraCoreAutostart: Checking for container updates...');
      
      setStatus(prev => ({
        ...prev,
        updateChecking: true,
        updateError: null
      }));

      // Check for Clara Core container updates specifically
      const updateResult = await docker.checkForUpdates((statusMessage: string) => {
        console.log('📦 Update check status:', statusMessage);
        setStatus(prev => ({
          ...prev,
          phase: prev.isStarting ? prev.phase : `Checking updates: ${statusMessage}`
        }));
      });

      const claraCoreUpdate = updateResult.updates?.find((update: any) => 
        update.imageName?.includes('clara-core') || 
        update.containerName === 'clara-core'
      );

      const hasUpdate = Boolean(claraCoreUpdate?.hasUpdate);
      
      setStatus(prev => ({
        ...prev,
        updateAvailable: hasUpdate,
        updateChecking: false,
        updateError: null,
        phase: prev.isStarting ? prev.phase : (hasUpdate ? 'Update available' : 'Up to date')
      }));

      if (hasUpdate) {
        console.log('📦 useClaraCoreAutostart: Container update available for Clara Core');
      } else {
        console.log('📦 useClaraCoreAutostart: Clara Core container is up to date');
      }

      return hasUpdate;
    } catch (error) {
      console.error('📦 useClaraCoreAutostart: Failed to check for updates:', error);
      
      setStatus(prev => ({
        ...prev,
        updateChecking: false,
        updateError: error instanceof Error ? error.message : 'Update check failed',
        phase: prev.isStarting ? prev.phase : 'Update check failed'
      }));
      
      return false;
    }
  }, []);

  // Update containers
  const updateContainers = useCallback(async (): Promise<boolean> => {
    try {
      const docker = (window as any).docker;
      if (!docker) {
        throw new Error('Docker service not available');
      }

      console.log('📦 useClaraCoreAutostart: Updating Clara Core container...');
      
      setStatus(prev => ({
        ...prev,
        isStarting: true,
        phase: 'Updating container',
        updateAvailable: false
      }));

      // Update Clara Core container specifically
      const updateResult = await docker.updateContainers(['clara-core'], (statusMessage: string) => {
        console.log('📦 Update status:', statusMessage);
        setStatus(prev => ({
          ...prev,
          phase: `Updating: ${statusMessage}`
        }));
      });

      const claraResult = updateResult.find((result: any) => result.container === 'clara-core');
      
      if (claraResult?.success) {
        console.log('📦 useClaraCoreAutostart: Clara Core container updated successfully');
        
        // Wait for the updated container to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if the service is running after update
        const isRunning = await checkClaraCoreStatus();
        
        setStatus(prev => ({
          ...prev,
          isRunning,
          isStarting: false,
          phase: isRunning ? 'Updated and running' : 'Updated, starting service',
          updateError: null
        }));

        return isRunning;
      } else {
        throw new Error(claraResult?.error || 'Container update failed');
      }
    } catch (error) {
      console.error('📦 useClaraCoreAutostart: Failed to update container:', error);
      
      setStatus(prev => ({
        ...prev,
        isStarting: false,
        updateError: error instanceof Error ? error.message : 'Update failed',
        phase: 'Update failed'
      }));
      
      return false;
    }
  }, []);

  // Check Clara Core status
  const checkClaraCoreStatus = useCallback(async (): Promise<boolean> => {
    try {
      const llamaSwap = (window as any).llamaSwap;
      if (!llamaSwap) {
        console.warn('📝 useClaraCoreAutostart: LlamaSwap service not available');
        return false;
      }

      const statusResult = await llamaSwap.getStatusWithHealth();
      return statusResult.isRunning && statusResult.isResponding;
    } catch (error) {
      console.error('📝 useClaraCoreAutostart: Failed to check Clara Core status:', error);
      return false;
    }
  }, []);

  // Start Clara Core
  const startClaraCore = useCallback(async (): Promise<boolean> => {
    try {
      const llamaSwap = (window as any).llamaSwap;
      if (!llamaSwap) {
        throw new Error('LlamaSwap service not available');
      }

      console.log('📝 useClaraCoreAutostart: Starting Clara Core for notebook:', notebook?.name);
      
      setStatus(prev => ({
        ...prev,
        isStarting: true,
        error: null,
        serviceName: "Clara's Core",
        phase: 'Starting'
      }));

      const startResult = await llamaSwap.start();
      
      if (startResult.success) {
        console.log('📝 useClaraCoreAutostart: Clara Core started successfully');
        
        // Wait a moment for the service to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify it's actually running
        const isRunning = await checkClaraCoreStatus();
        
        setStatus(prev => ({
          ...prev,
          isRunning: isRunning,
          isStarting: false,
          phase: isRunning ? 'Running' : 'Failed to verify',
          error: isRunning ? null : 'Service started but health check failed'
        }));
        
        return isRunning;
      } else {
        throw new Error(startResult.error || 'Failed to start Clara Core');
      }
    } catch (error) {
      console.error('📝 useClaraCoreAutostart: Failed to start Clara Core:', error);
      
      setStatus(prev => ({
        ...prev,
        isStarting: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        phase: 'Failed'
      }));
      
      return false;
    }
  }, [notebook?.name, checkClaraCoreStatus]);

  // Auto-start Clara Core when notebook requires it
  useEffect(() => {
    const handleNotebookChange = async () => {
      if (!notebook) {
        // Reset status when no notebook is selected
        setStatus({
          isRunning: false,
          isStarting: false,
          error: null,
          serviceName: null,
          phase: null,
          updateAvailable: false,
          updateChecking: false,
          updateError: null
        });
        return;
      }

      if (!requiresClaraCore(notebook)) {
        console.log('📝 useClaraCoreAutostart: Notebook does not require Clara Core:', notebook.name);
        return;
      }

      console.log('📝 useClaraCoreAutostart: Notebook requires Clara Core, checking status and updates...', notebook.name);
      
      // First check for updates
      const hasUpdates = await checkForUpdates();
      
      // Check if Clara Core is already running
      const isRunning = await checkClaraCoreStatus();
      
      if (isRunning && !hasUpdates) {
        console.log('📝 useClaraCoreAutostart: Clara Core is running and up to date');
        setStatus(prev => ({
          ...prev,
          isRunning: true,
          isStarting: false,
          error: null,
          serviceName: "Clara's Core",
          phase: 'Running'
        }));
        return;
      }

      if (hasUpdates) {
        console.log('📝 useClaraCoreAutostart: Container updates available, user should be prompted');
        setStatus(prev => ({
          ...prev,
          isRunning,
          serviceName: "Clara's Core",
          phase: isRunning ? 'Running (update available)' : 'Update available'
        }));
        return;
      }

      // Start Clara Core if not running and no updates
      if (!isRunning) {
        console.log('📝 useClaraCoreAutostart: Clara Core not running, starting automatically...');
        await startClaraCore();
      }
    };

    handleNotebookChange();
  }, [notebook, requiresClaraCore, checkClaraCoreStatus, checkForUpdates, startClaraCore]);

  // Periodic health check when Clara Core should be running
  useEffect(() => {
    if (!notebook || !requiresClaraCore(notebook)) return;

    const interval = setInterval(async () => {
      if (status.isStarting) return; // Don't check while starting

      const isRunning = await checkClaraCoreStatus();
      
      setStatus(prev => {
        if (prev.isRunning !== isRunning) {
          console.log('📝 useClaraCoreAutostart: Clara Core status changed:', { was: prev.isRunning, now: isRunning });
          return {
            ...prev,
            isRunning,
            phase: isRunning ? 'Running' : 'Stopped',
            error: !isRunning && prev.isRunning ? 'Service stopped unexpectedly' : null
          };
        }
        return prev;
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [notebook, requiresClaraCore, checkClaraCoreStatus, status.isStarting]);

  return {
    ...status,
    requiresClaraCore: notebook ? requiresClaraCore(notebook) : false,
    startClaraCore,
    checkStatus: checkClaraCoreStatus,
    checkForUpdates,
    updateContainers
  };
};
