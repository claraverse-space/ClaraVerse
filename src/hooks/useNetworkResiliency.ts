import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to preserve React state during network service crashes
 * Prevents loss of user data and application state during Electron network restarts
 */
export const useNetworkResiliency = () => {
  const stateRef = useRef<any>(null);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const preserveState = useCallback((stateToPreserve: any) => {
    stateRef.current = {
      ...stateToPreserve,
      timestamp: Date.now(),
      url: window.location.href
    };
    
    // Store in sessionStorage as backup
    try {
      sessionStorage.setItem('__network_recovery_state__', JSON.stringify(stateRef.current));
    } catch (error) {
      console.warn('Failed to store recovery state:', error);
    }
  }, []);

  const restoreState = useCallback(() => {
    // Try memory first, then sessionStorage
    let recoveredState = stateRef.current;
    
    if (!recoveredState) {
      try {
        const stored = sessionStorage.getItem('__network_recovery_state__');
        if (stored) {
          recoveredState = JSON.parse(stored);
          sessionStorage.removeItem('__network_recovery_state__');
        }
      } catch (error) {
        console.warn('Failed to restore from sessionStorage:', error);
      }
    }

    return recoveredState;
  }, []);

  useEffect(() => {
    // Listen for network recovery signals
    const handleNetworkRecovery = () => {
      console.log('🔄 Network service recovered, checking for preserved state...');
      
      const restored = restoreState();
      if (restored && Date.now() - restored.timestamp < 30000) { // Within 30 seconds
        console.log('✅ State recovered after network crash');
        
        // Dispatch custom event for components to handle recovery
        window.dispatchEvent(new CustomEvent('network-state-recovered', {
          detail: restored
        }));
      }
    };

    // Listen for network recovery from Electron
    if (window.electron) {
      window.electron.networkRecovered = handleNetworkRecovery;
    }

    // Monitor for unexpected page unloads (potential crashes)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only preserve state if this seems like an unexpected unload
      if (!document.hidden && performance.now() > 5000) { // App has been running for 5+ seconds
        preserveState({
          location: window.location.href,
          formData: gatherFormData(),
          appState: gatherReactState()
        });
      }
    };

    const gatherFormData = () => {
      const formData: Record<string, any> = {};
      document.querySelectorAll('input, textarea, select').forEach((elem, index) => {
        const element = elem as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (element.value && (element.id || element.name)) {
          formData[element.id || element.name || `element_${index}`] = {
            type: element.type,
            value: element.value,
            tagName: element.tagName
          };
        }
      });
      return formData;
    };

    const gatherReactState = () => {
      // Try to gather some basic React state information
      try {
        const rootElement = document.getElementById('root');
        if (rootElement && (rootElement as any)._reactInternalFiber) {
          return { hasReactRoot: true };
        }
      } catch (error) {
        console.debug('Could not gather React state:', error);
      }
      return {};
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, [preserveState, restoreState]);

  return {
    preserveState,
    restoreState
  };
};

/**
 * Hook for components to handle network recovery
 */
export const useNetworkRecovery = (onRecover?: (recoveredState: any) => void) => {
  useEffect(() => {
    const handleRecovery = (event: CustomEvent) => {
      if (onRecover) {
        onRecover(event.detail);
      }
    };

    window.addEventListener('network-state-recovered', handleRecovery);
    
    return () => {
      window.removeEventListener('network-state-recovered', handleRecovery);
    };
  }, [onRecover]);
};
