import React from 'react';

interface LoadingStatus {
  sdModels: 'pending' | 'loading' | 'success' | 'error';
  loras: 'pending' | 'loading' | 'success' | 'error';
  vaes: 'pending' | 'loading' | 'success' | 'error';
  systemStats: 'pending' | 'loading' | 'success' | 'error';
  connection: 'connecting' | 'connected' | 'error';
}

interface InitialLoadingOverlayProps {
  loadingStatus: LoadingStatus;
  connectionError: string | null;
}

const InitialLoadingOverlay: React.FC<InitialLoadingOverlayProps> = ({
  loadingStatus,
  connectionError
}) => {
  // Calculate overall progress percentage
  const calculateProgress = () => {
    const statusValues = Object.values(loadingStatus);
    const totalItems = statusValues.length;
    const completedItems = statusValues.filter(
      status => status === 'success' || status === 'error'
    ).length;
    
    return Math.floor((completedItems / totalItems) * 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'loading':
        return '🔄';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'connecting':
        return '🔌';
      case 'connected':
        return '🟢';
      default:
        return '⏳';
    }
  };

  const percentage = calculateProgress();
  const isComplete = percentage === 100;
  const hasError = connectionError || Object.values(loadingStatus).some(status => status === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-white backdrop-blur-sm">
      <div className="max-w-md w-full bg-gray-900/80 p-8 rounded-xl border border-gray-700 shadow-2xl">
        <h3 className="text-xl font-medium mb-6 text-center">
          {connectionError 
            ? 'Connection Error' 
            : isComplete 
              ? 'Setup Complete!' 
              : 'Setting up ComfyUI Connection'}
        </h3>
        
        {connectionError ? (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-200 font-medium">Failed to connect to ComfyUI</p>
            <p className="text-sm text-red-300 mt-2">{connectionError}</p>
            <p className="text-xs text-red-300 mt-4">
              Please make sure ComfyUI is running and accessible at the configured URL.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <span>Establishing connection</span>
                <span>{getStatusIcon(loadingStatus.connection)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Loading SD Models</span>
                <span>{getStatusIcon(loadingStatus.sdModels)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Loading LoRA Models</span>
                <span>{getStatusIcon(loadingStatus.loras)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Loading VAE Models</span>
                <span>{getStatusIcon(loadingStatus.vaes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Loading System Stats</span>
                <span>{getStatusIcon(loadingStatus.systemStats)}</span>
              </div>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
              <div 
                className={`h-2.5 rounded-full ${hasError ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${percentage}%`, transition: 'width 0.5s ease-in-out' }}
              ></div>
            </div>
            
            <div className="text-center text-sm">
              {hasError ? (
                <span className="text-yellow-400">Setup completed with some errors</span>
              ) : isComplete ? (
                <span className="text-green-400">All systems ready!</span>
              ) : (
                <span>{percentage}% Complete</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InitialLoadingOverlay;
