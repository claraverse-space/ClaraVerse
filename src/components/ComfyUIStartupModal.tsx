import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, CheckCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

interface ComfyUIStartupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  comfyuiMode: string;
  comfyuiUrl: string;
}

interface DockerStatus {
  dockerRunning: boolean;
  error?: string;
}

interface ServiceStatus {
  running: boolean;
  serviceUrl?: string;
  error?: string;
}

interface StartupProgress {
  message: string;
  progress: number;
  type?: string;
  stage?: 'pulling' | 'starting' | 'network' | 'health';
}

const ComfyUIStartupModal: React.FC<ComfyUIStartupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  comfyuiMode,
  comfyuiUrl
}) => {
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startupProgress, setStartupProgress] = useState<StartupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Check status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  // Listen for startup progress updates
  useEffect(() => {
    if (!isOpen) return;

    const handleProgress = (_event: any, data: StartupProgress) => {
      console.log('ComfyUI startup progress:', data);
      setStartupProgress(data);
    };

    // Add event listener
    if ((window as any).electronAPI?.on) {
      (window as any).electronAPI.on('comfyui:startup-progress', handleProgress);
    }

    return () => {
      // Remove event listener
      if ((window as any).electronAPI?.removeListener) {
        (window as any).electronAPI.removeListener('comfyui:startup-progress', handleProgress);
      }
    };
  }, [isOpen]);

  const checkStatus = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      // Only check Docker status if in Docker mode
      if (comfyuiMode === 'docker') {
        console.log('Checking Docker status...');
        const dockerResult = await (window as any).electronAPI.invoke('comfyui:check-docker-status');
        console.log('Docker status result:', dockerResult);
        setDockerStatus(dockerResult);
      }

      // Check service status
      console.log('Checking ComfyUI service status...');
      const serviceResult = await (window as any).electronAPI.invoke('comfyui:check-service-status');
      console.log('Service status result:', serviceResult);
      setServiceStatus(serviceResult);

      // If service is running, call onSuccess
      if (serviceResult.running) {
        console.log('ComfyUI is already running, closing modal');
        onSuccess();
      }
    } catch (err) {
      console.error('Error checking status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check status');
    } finally {
      setIsChecking(false);
    }
  };

  const startComfyUIContainer = async () => {
    setIsStarting(true);
    setError(null);
    setStartupProgress(null);

    try {
      console.log('Starting ComfyUI container...');
      const result = await (window as any).electronAPI.invoke('comfyui:start-container');
      console.log('Start container result:', result);

      if (result.success) {
        console.log('ComfyUI container started successfully');
        // Small delay to ensure service is ready
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setError(result.error || 'Failed to start ComfyUI container');
      }
    } catch (err) {
      console.error('Error starting ComfyUI container:', err);
      setError(err instanceof Error ? err.message : 'Failed to start ComfyUI container');
    } finally {
      setIsStarting(false);
      setStartupProgress(null);
    }
  };

  const openComfyUIInBrowser = () => {
    window.open(comfyuiUrl, '_blank');
  };

  if (!isOpen) return null;

  const isManualMode = comfyuiMode === 'manual';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isManualMode ? 'ComfyUI Service Not Responding' : 'ComfyUI Setup Required'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {isManualMode ? (
            // Manual mode - service not responding
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Your ComfyUI service at <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{comfyuiUrl}</span> is not responding.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Please check that your ComfyUI service is running and accessible.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={checkStatus}
                  disabled={isChecking}
                  className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>{isChecking ? 'Checking...' : 'Check Again'}</span>
                </button>
                
                <button
                  onClick={openComfyUIInBrowser}
                  className="flex items-center justify-center space-x-2 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open URL</span>
                </button>
              </div>
            </div>
          ) : (
            // Docker mode - container startup
            <div className="space-y-4">
              {/* Docker Status */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-shrink-0">
                  {isChecking ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : dockerStatus?.dockerRunning ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Docker Status
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {isChecking 
                      ? 'Checking...' 
                      : dockerStatus?.dockerRunning 
                        ? 'Docker is running' 
                        : 'Docker is not running'}
                  </p>
                </div>
              </div>

              {/* Service Status */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-shrink-0">
                  {isChecking ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : serviceStatus?.running ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ComfyUI Status
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {isChecking 
                      ? 'Checking...' 
                      : serviceStatus?.running 
                        ? 'ComfyUI is running' 
                        : 'ComfyUI is not running'}
                  </p>
                </div>
              </div>

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
                      {startupProgress.message.includes('network') && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Setting up container networking for ComfyUI
                        </p>
                      )}
                      {(startupProgress.message.includes('health') || startupProgress.message.includes('Health')) && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Verifying ComfyUI service is responding properly
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
                      <p>• Downloading ComfyUI Docker image (~2-4 GB)</p>
                      <p>• This only happens once - future starts will be much faster</p>
                      <p>• You can safely minimize this window while downloading</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                {dockerStatus?.dockerRunning ? (
                  <button
                    onClick={startComfyUIContainer}
                    disabled={isStarting || serviceStatus?.running}
                    className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isStarting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>
                      {isStarting ? (
                        startupProgress?.stage === 'pulling' 
                          ? 'Downloading Docker Image...' 
                          : 'Starting... (First Launch may take a while)'
                      ) : serviceStatus?.running ? 'Running' : 'Start ComfyUI'}
                    </span>
                  </button>
                ) : (
                  <div className="flex-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
                      Please start Docker Desktop first
                    </p>
                  </div>
                )}
                
                <button
                  onClick={checkStatus}
                  disabled={isChecking}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComfyUIStartupModal;
