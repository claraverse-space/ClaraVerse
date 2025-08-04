import React, { useState, useEffect } from 'react';
import { Play, AlertCircle, CheckCircle, Loader, RefreshCcw, X } from 'lucide-react';

interface N8NStartupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (serviceUrl: string) => void;
  n8nMode: string;
  n8nUrl: string;
}

interface StartupProgress {
  message: string;
  progress: number;
}

const N8NStartupModal: React.FC<N8NStartupModalProps> = ({ isOpen, onClose, onSuccess, n8nMode, n8nUrl }) => {
  const [dockerStatus, setDockerStatus] = useState<'checking' | 'running' | 'not-running' | 'error'>('checking');
  const [n8nStatus, setN8nStatus] = useState<'checking' | 'running' | 'not-running' | 'starting' | 'error'>('checking');
  const [startupProgress, setStartupProgress] = useState<StartupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Check if this is manual mode
  const isManualMode = n8nMode === 'manual';

  // Check initial status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkStatus();
      
      // Listen for startup progress updates
      const handleStartupProgress = (_event: any, progress: StartupProgress) => {
        setStartupProgress(progress);
      };

      if ((window as any).electronAPI?.ipcRenderer) {
        (window as any).electronAPI.ipcRenderer.on('n8n:startup-progress', handleStartupProgress);
        
        return () => {
          (window as any).electronAPI.ipcRenderer.removeListener('n8n:startup-progress', handleStartupProgress);
        };
      }
    }
  }, [isOpen]);

  const checkStatus = async () => {
    setError(null);
    
    try {
      // For manual mode, skip Docker check and only check N8N service
      if (isManualMode) {
        setDockerStatus('running'); // Not applicable for manual mode
        
        // Check N8N status
        setN8nStatus('checking');
        const n8nResult = await (window as any).electronAPI.invoke('n8n:check-service-status');
        
        if (n8nResult.error) {
          setError(`Cannot connect to N8N service at ${n8nUrl}: ${n8nResult.error}`);
          setN8nStatus('error');
          return;
        }
        
        if (n8nResult.running) {
          setN8nStatus('running');
          // If N8N is already running, close modal and notify parent
          setTimeout(() => {
            onSuccess(n8nResult.serviceUrl);
          }, 1000);
        } else {
          setN8nStatus('not-running');
          setError(`N8N service at ${n8nUrl} is not responding. Please check that your N8N service is running and accessible.`);
        }
        return;
      }
      
      // Docker mode logic (existing)
      // Check Docker status
      setDockerStatus('checking');
      const dockerResult = await (window as any).electronAPI.invoke('n8n:check-docker-status');
      
      if (dockerResult.error) {
        setError(dockerResult.error);
        setDockerStatus('error');
        return;
      }
      
      setDockerStatus(dockerResult.dockerRunning ? 'running' : 'not-running');
      
      if (!dockerResult.dockerRunning) {
        return;
      }
      
      // Check N8N status
      setN8nStatus('checking');
      const n8nResult = await (window as any).electronAPI.invoke('n8n:check-service-status');
      
      if (n8nResult.error) {
        setError(n8nResult.error);
        setN8nStatus('error');
        return;
      }
      
      if (n8nResult.running) {
        setN8nStatus('running');
        // If N8N is already running, close modal and notify parent
        setTimeout(() => {
          onSuccess(n8nResult.serviceUrl);
        }, 1000);
      } else {
        setN8nStatus('not-running');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setDockerStatus('error');
      setN8nStatus('error');
    }
  };

  const startN8NContainer = async () => {
    setIsStarting(true);
    setN8nStatus('starting');
    setStartupProgress(null);
    setError(null);
    
    try {
      const result = await (window as any).electronAPI.invoke('n8n:start-container');
      
      if (result.success) {
        setN8nStatus('running');
        setStartupProgress(null);
        
        // Wait a moment then notify parent and close modal
        setTimeout(() => {
          onSuccess(result.serviceUrl);
        }, 1000);
      } else {
        setError(result.error || 'Failed to start N8N container');
        setN8nStatus('error');
        setStartupProgress(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setN8nStatus('error');
      setStartupProgress(null);
    } finally {
      setIsStarting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checking':
        return <Loader className="w-5 h-5 animate-spin text-blue-500" />;
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'not-running':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'starting':
        return <Loader className="w-5 h-5 animate-spin text-blue-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string, service: string) => {
    switch (status) {
      case 'checking':
        return `Checking ${service} status...`;
      case 'running':
        return `${service} is running`;
      case 'not-running':
        return `${service} is not running`;
      case 'starting':
        return `Starting ${service}...`;
      case 'error':
        return `${service} error`;
      default:
        return `${service} status unknown`;
    }
  };

  const canStartN8N = !isManualMode && dockerStatus === 'running' && n8nStatus === 'not-running' && !isStarting;
  const shouldShowStartButton = !isManualMode && dockerStatus === 'running' && (n8nStatus === 'not-running' || n8nStatus === 'error');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isManualMode ? 'N8N Service Connection' : 'N8N Service Startup'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            disabled={isStarting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {isManualMode ? (
            // Manual Mode: Show configured URL and connection status
            <>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    Configured N8N URL
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400 break-all">
                    {n8nUrl}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {getStatusIcon(n8nStatus)}
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    Connection Status
                  </div>
                  {n8nStatus === 'running' && (
                    <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Service is responding and ready!
                    </div>
                  )}
                  {n8nStatus === 'not-running' && (
                    <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Service is not responding
                    </div>
                  )}
                  {n8nStatus === 'checking' && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Checking connection...
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Docker Mode: Show Docker and N8N status
            <>
              {/* Docker Status */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {getStatusIcon(dockerStatus)}
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {getStatusText(dockerStatus, 'Docker')}
                  </div>
                  {dockerStatus === 'not-running' && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Please start Docker Desktop and try again
                    </div>
                  )}
                </div>
              </div>

              {/* N8N Status */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {getStatusIcon(n8nStatus)}
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {getStatusText(n8nStatus, 'N8N')}
                  </div>
                  {n8nStatus === 'running' && (
                    <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Service is ready!
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Startup Progress */}
          {startupProgress && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {startupProgress.message}
                </span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${startupProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6">
          {isManualMode ? (
            // Manual mode: Only show refresh and close buttons
            <>
              <button
                onClick={checkStatus}
                disabled={isStarting}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Retry Connection
              </button>
              
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            // Docker mode: Show start button if applicable
            <>
              {shouldShowStartButton && (
                <button
                  onClick={startN8NContainer}
                  disabled={!canStartN8N}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {isStarting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start N8N
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={checkStatus}
                disabled={isStarting}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>

              {!shouldShowStartButton && !isStarting && (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default N8NStartupModal;
