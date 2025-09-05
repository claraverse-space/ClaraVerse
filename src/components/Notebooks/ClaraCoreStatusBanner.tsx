/**
 * Clara Core Status Banner
 * 
 * Displays the status of Clara Core startup/running state in notebooks
 * Enhanced with container update checking and prompts
 */

import React, { useState } from 'react';
import { 
  Server, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  ArrowUp,
  Clock,
  Shield
} from 'lucide-react';

interface ClaraCoreStatusBannerProps {
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;
  serviceName: string | null;
  phase: string | null;
  requiresClaraCore: boolean;
  onRetry?: () => void;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  // Enhanced props for update functionality
  updateAvailable?: boolean;
  updateChecking?: boolean;
  updateError?: string | null;
  onCheckForUpdates?: () => Promise<boolean>;
  onUpdateContainers?: () => Promise<boolean>;
}

const ClaraCoreStatusBanner: React.FC<ClaraCoreStatusBannerProps> = ({
  isRunning,
  isStarting,
  error,
  serviceName,
  phase,
  requiresClaraCore,
  onRetry,
  isVisible = true,
  onToggleVisibility,
  updateAvailable = false,
  updateChecking = false,
  updateError = null,
  onCheckForUpdates,
  onUpdateContainers
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  // Don't show if notebook doesn't require Clara Core
  if (!requiresClaraCore) return null;

  // Show update prompt even when running if updates are available
  const shouldShow = !isRunning || error || isStarting || updateAvailable || updateChecking || updateError;
  
  if (!shouldShow && !showUpdatePrompt) return null;

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={onToggleVisibility}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
          title="Show Clara Core status"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const getStatusIcon = () => {
    if (isUpdating || updateChecking) {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
    if (updateAvailable) {
      return <ArrowUp className="w-5 h-5 text-orange-500" />;
    }
    if (isStarting) {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
    if (error || updateError) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (isRunning) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (updateAvailable) return 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20';
    if (isUpdating || updateChecking || isStarting) return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
    if (error || updateError) return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
    if (isRunning) return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
    return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
  };

  const getStatusText = () => {
    if (isUpdating) return 'Updating Clara Core container...';
    if (updateChecking) return 'Checking for container updates...';
    if (updateAvailable) return 'Container update available!';
    if (updateError) return `Update Error: ${updateError}`;
    if (isStarting) return `Starting ${serviceName || "Clara's Core"}...`;
    if (error) return `Clara Core Error: ${error}`;
    if (isRunning) return `${serviceName || "Clara's Core"} is running`;
    return `${serviceName || "Clara's Core"} is not running`;
  };

  const getPhaseText = () => {
    if (updateAvailable && !isUpdating && !updateChecking) {
      return 'A newer version of Clara Core is available. Update recommended for latest features and security fixes.';
    }
    if (updateChecking) return 'Checking Docker registry for newer container images...';
    if (isUpdating) return 'Downloading and updating container images...';
    if (phase && isStarting) return `Phase: ${phase}`;
    if (phase && !isStarting) return phase;
    return null;
  };

  const handleUpdate = async () => {
    if (!onUpdateContainers) return;
    
    setIsUpdating(true);
    setShowUpdatePrompt(false);
    
    try {
      await onUpdateContainers();
    } catch (error) {
      console.error('Failed to update containers:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (!onCheckForUpdates) return;
    
    try {
      const hasUpdates = await onCheckForUpdates();
      if (hasUpdates) {
        setShowUpdatePrompt(true);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-2 fade-in-0`}>
      <div className={`glassmorphic border rounded-xl shadow-lg backdrop-blur-xl p-4 ${getStatusColor()}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getStatusIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Clara Core Status
              </h4>
              <div className="flex items-center gap-1">
                {onRetry && error && (
                  <button
                    onClick={onRetry}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Retry starting Clara Core"
                  >
                    <RefreshCw className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
                {onCheckForUpdates && !updateChecking && !isUpdating && (
                  <button
                    onClick={handleCheckUpdates}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Check for container updates"
                  >
                    <Download className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
                {onToggleVisibility && (
                  <button
                    onClick={onToggleVisibility}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Hide status"
                  >
                    <EyeOff className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
              </div>
            </div>
            
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
              {getStatusText()}
            </p>
            
            {getPhaseText() && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {getPhaseText()}
              </p>
            )}
            
            {(isStarting || isUpdating) && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all duration-1000 animate-pulse"
                    style={{ width: isUpdating ? '80%' : '60%' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Update Actions */}
        {updateAvailable && onUpdateContainers && !isUpdating && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Container Update Available
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Update now to get the latest features, security fixes, and performance improvements.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Update Now
              </button>
              <button
                onClick={() => setShowUpdatePrompt(false)}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        )}
        
        {/* Error and Retry Actions */}
        {error && onRetry && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onRetry}
              className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Starting Clara Core
            </button>
          </div>
        )}
        
        {/* Running Status */}
        {isRunning && !updateAvailable && (
          <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <Server className="w-3 h-3" />
            <span>Ready for local AI processing</span>
            {onCheckForUpdates && (
              <>
                <span>•</span>
                <button
                  onClick={handleCheckUpdates}
                  className="hover:underline flex items-center gap-1"
                  disabled={updateChecking}
                >
                  {updateChecking ? (
                    <>
                      <Clock className="w-3 h-3 animate-pulse" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3" />
                      <span>Check for updates</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaraCoreStatusBanner;
