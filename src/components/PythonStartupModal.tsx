import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Loader2, ExternalLink } from 'lucide-react';

interface PythonStartupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartupComplete: () => void;
}

interface ServiceStatus {
  isHealthy: boolean;
  serviceUrl: string | null;
  mode: 'docker' | 'manual';
}

interface StartupProgress {
  message: string;
  progress: number;
  type?: string;
  stage?: 'pulling' | 'starting' | 'network' | 'health';
}

const PythonStartupModal: React.FC<PythonStartupModalProps> = ({
  isOpen,
  onClose,
  onStartupComplete
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [dockerAvailable, setDockerAvailable] = useState<boolean>(false);
  const [startupProgress, setStartupProgress] = useState<StartupProgress | null>(null);

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      setError('');
      setStatus('Checking Python backend status...');

      // Check if electronAPI is available
      if (!(window as any).electronAPI) {
        throw new Error('Electron API not available');
      }

      // Check if Docker is available
      const dockerStatus = await (window as any).electronAPI.invoke('check-docker-status');
      setDockerAvailable(dockerStatus.isRunning);

      // Check Python backend status
      const pythonStatus = await (window as any).electronAPI.invoke('check-python-status');
      setServiceStatus(pythonStatus);

      if (pythonStatus.isHealthy) {
        setStatus('Python backend is running and healthy');
        setTimeout(() => {
          onStartupComplete();
          onClose();
        }, 1000);
      } else {
        if (pythonStatus.mode === 'docker') {
          setStatus('Python backend container is not running');
        } else {
          setStatus('Python backend is not responding');
        }
      }
    } catch (err) {
      setError(`Failed to check Python backend status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startPythonContainer = async () => {
    try {
      setIsLoading(true);
      setError('');
      setStartupProgress(null);
      setStatus('Starting Python backend container...');

      // Check if electronAPI is available
      if (!(window as any).electronAPI) {
        throw new Error('Electron API not available');
      }

      const result = await (window as any).electronAPI.invoke('start-python-container');
      
      if (result.success) {
        setStatus('Python backend container started successfully');
        setStartupProgress(null);
        // Wait a bit for the service to fully initialize
        setTimeout(async () => {
          await checkStatus();
        }, 3000);
      } else {
        setError(result.error || 'Failed to start Python backend container');
        setStartupProgress(null);
      }
    } catch (err) {
      setError(`Failed to start Python backend container: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStartupProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      
      // Listen for startup progress updates
      const handleStartupProgress = (_event: any, progress: StartupProgress) => {
        setStartupProgress(progress);
      };

      if ((window as any).electronAPI?.on) {
        (window as any).electronAPI.on('python:startup-progress', handleStartupProgress);
        
        return () => {
          if ((window as any).electronAPI?.removeListener) {
            (window as any).electronAPI.removeListener('python:startup-progress', handleStartupProgress);
          }
        };
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openServiceUrl = () => {
    if (serviceStatus?.serviceUrl) {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.invoke('open-external', serviceStatus.serviceUrl);
      } else {
        // Fallback to window.open if electron API is not available
        window.open(serviceStatus.serviceUrl, '_blank');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Python Backend Status
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Docker Status */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Docker:</span>
            {dockerAvailable ? (
              <div className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="text-sm">Available</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 mr-1" />
                <span className="text-sm">Not available</span>
              </div>
            )}
          </div>

          {/* Service Status */}
          {serviceStatus && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Service:</span>
                {serviceStatus.isHealthy ? (
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    <span className="text-sm">Running</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    <span className="text-sm">Not running</span>
                  </div>
                )}
              </div>

              {serviceStatus.serviceUrl && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">URL:</span>
                  <button
                    onClick={openServiceUrl}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center"
                  >
                    {serviceStatus.serviceUrl}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Mode:</span>
                <span className="text-sm text-gray-900 dark:text-white capitalize">
                  {serviceStatus.mode}
                </span>
              </div>
            </div>
          )}

          {/* Current Status */}
          {status && !startupProgress && (
            <div className="flex items-center space-x-2">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              <span className="text-sm text-gray-700 dark:text-gray-300">{status}</span>
            </div>
          )}

          {/* Startup Progress */}
          {startupProgress && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <div className="flex-1">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {startupProgress.message}
                  </p>
                  {startupProgress.stage === 'pulling' && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Downloading Docker image - this may take several minutes on first run
                    </p>
                  )}
                  {(startupProgress.message.includes('network') || startupProgress.message.includes('Network')) && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Setting up container networking for Python backend
                    </p>
                  )}
                  {(startupProgress.message.includes('health') || startupProgress.message.includes('Health')) && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Verifying Python backend service is responding properly
                    </p>
                  )}
                </div>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${startupProgress.progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {startupProgress.stage === 'pulling' ? 'Downloading' : 
                   startupProgress.stage === 'network' ? 'Setting up' :
                   startupProgress.stage === 'health' ? 'Verifying' : 'Starting'}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {startupProgress.progress}%
                </span>
              </div>
              {startupProgress.stage === 'pulling' && startupProgress.progress < 100 && (
                <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-800/30 rounded text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-medium">First-time setup in progress:</p>
                  <p>• Downloading Python backend Docker image (~8-9 GB)</p>
                  <p>• This only happens once - future starts will be much faster</p>
                  <p>• You can safely minimize this window while downloading</p>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            {serviceStatus && !serviceStatus.isHealthy && (
              <>
                {serviceStatus.mode === 'docker' && dockerAvailable && (
                  <button
                    onClick={startPythonContainer}
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {startupProgress?.stage === 'pulling' 
                          ? 'Downloading Docker Image...' 
                          : 'Starting...'}
                      </>
                    ) : (
                      'Start Python Backend'
                    )}
                  </button>
                )}
                
                {(serviceStatus.mode === 'manual' || !dockerAvailable) && (
                  <div className="flex-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      {serviceStatus.mode === 'manual' 
                        ? 'Please start your Python backend service manually.'
                        : 'Docker is not available. Please start your Python backend service manually or install Docker.'}
                    </p>
                  </div>
                )}
              </>
            )}

            <button
              onClick={checkStatus}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PythonStartupModal;
