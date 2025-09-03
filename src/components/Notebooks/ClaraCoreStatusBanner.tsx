/**
 * Clara Core Status Banner
 * 
 * Displays the status of Clara Core startup/running state in notebooks
 */

import React from 'react';
import { 
  Server, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff
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
  onToggleVisibility
}) => {
  // Don't show if notebook doesn't require Clara Core
  if (!requiresClaraCore) return null;

  // Don't show if running and no errors (clean UI when everything is working)
  if (isRunning && !error && !isStarting) return null;

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
    if (isStarting) {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
    if (error) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (isRunning) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (isStarting) return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
    if (error) return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
    if (isRunning) return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
    return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
  };

  const getStatusText = () => {
    if (isStarting) return `Starting ${serviceName || "Clara's Core"}...`;
    if (error) return `Clara Core Error: ${error}`;
    if (isRunning) return `${serviceName || "Clara's Core"} is running`;
    return `${serviceName || "Clara's Core"} is not running`;
  };

  const getPhaseText = () => {
    if (phase && isStarting) return `Phase: ${phase}`;
    if (phase && !isStarting) return phase;
    return null;
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
            
            {isStarting && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all duration-1000 animate-pulse"
                    style={{ width: '60%' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
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
        
        {isRunning && (
          <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <Server className="w-3 h-3" />
            <span>Ready for local AI processing</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaraCoreStatusBanner;
