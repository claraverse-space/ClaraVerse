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
      setStatus('Starting Python backend container...');

      // Check if electronAPI is available
      if (!(window as any).electronAPI) {
        throw new Error('Electron API not available');
      }

      const result = await (window as any).electronAPI.invoke('start-python-container');
      
      if (result.success) {
        setStatus('Python backend container started successfully');
        // Wait a bit for the service to fully initialize
        setTimeout(async () => {
          await checkStatus();
        }, 3000);
      } else {
        setError(result.error || 'Failed to start Python backend container');
      }
    } catch (err) {
      setError(`Failed to start Python backend container: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
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
          {status && (
            <div className="flex items-center space-x-2">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              <span className="text-sm text-gray-700 dark:text-gray-300">{status}</span>
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
                        Starting...
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
