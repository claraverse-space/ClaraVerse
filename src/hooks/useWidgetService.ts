import { useEffect, useState, useCallback } from 'react';
import { widgetServiceClient } from '../services/widgetServiceClient';
import type { WidgetServiceStatus } from '../types/widgetService';

interface UseWidgetServiceOptions {
  widgets: any[];
  autoManage?: boolean;
}

export const useWidgetService = ({ widgets, autoManage = true }: UseWidgetServiceOptions) => {
  const [status, setStatus] = useState<WidgetServiceStatus>({
    running: false,
    port: 8765,
    activeWidgets: [],
    shouldRun: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(async () => {
    try {
      const response = await widgetServiceClient.getStatus();
      if (response.success && response.status) {
        setStatus(response.status);
        setError(null);
      } else {
        setError(response.error || 'Failed to get status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const manageService = useCallback(async () => {
    if (!autoManage) return;

    setIsLoading(true);
    setError(null);

    try {
      // Register widgets that need the service
      const gpuWidgets = widgets.filter(w => w.type === 'gpu-monitor');
      
      // Register GPU widgets if any exist
      if (gpuWidgets.length > 0) {
        // Register each GPU widget instance
        await widgetServiceClient.registerWidget('gpu-monitor');
      }
      
      // Manage the service (start/stop based on active widgets)
      const response = await widgetServiceClient.manage();
      if (response.success && response.status) {
        setStatus(response.status);
        setError(null);
      } else {
        setError(response.error || 'Failed to manage service');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus(prev => ({ ...prev, running: false }));
    } finally {
      setIsLoading(false);
    }
  }, [widgets, autoManage]);

  const startService = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await widgetServiceClient.start();
      if (response.success) {
        await updateStatus();
      } else {
        setError(response.error || 'Failed to start service');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus(prev => ({ ...prev, running: false }));
    } finally {
      setIsLoading(false);
    }
  }, [updateStatus]);

  const stopService = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await widgetServiceClient.stop();
      if (response.success) {
        setStatus(prev => ({ ...prev, running: false }));
      } else {
        setError(response.error || 'Failed to stop service');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial status check
  useEffect(() => {
    updateStatus();
  }, [updateStatus]);

  // Auto-manage service based on widgets
  useEffect(() => {
    if (autoManage) {
      manageService();
    }
  }, [widgets, manageService]);

  // Periodic status check
  useEffect(() => {
    const interval = setInterval(updateStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [updateStatus]);

  return {
    status,
    isLoading,
    error,
    startService,
    stopService,
    manageService,
    updateStatus
  };
};
