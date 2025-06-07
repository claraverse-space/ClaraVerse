import React, { useState, useRef } from 'react';
import { Globe, Play, Loader2, RefreshCw, ExternalLink, Monitor, Zap, Eye } from 'lucide-react';
import { Project } from '../../types';

interface PreviewPaneProps {
  project: Project;
  isStarting: boolean;
  onStartProject: (project: Project) => void;
}

const PreviewPane: React.FC<PreviewPaneProps> = ({ project, isStarting, onStartProject }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsRefreshing(true);
      // Add a small delay to show the refresh animation
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = iframeRef.current.src;
        }
        setIsRefreshing(false);
      }, 300);
    }
  };

  return (
    <div className="h-full flex flex-col glassmorphic">
      {/* Enhanced Header */}
      <div className="glassmorphic-card border-b border-white/20 dark:border-gray-700/50 shrink-0 h-14">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-sakura-600 dark:text-sakura-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Preview
                </span>
                {project.status === 'running' && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                      Live
                    </span>
                  </div>
                )}
                {project.status === 'idle' && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full font-medium">
                    Stopped
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {project.status === 'running' ? 'Application running' : 'Start project to preview'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {project.status === 'running' && project.previewUrl && (
              <>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 glassmorphic-card border border-white/30 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-sakura-500 dark:hover:text-sakura-400 rounded-lg transition-all duration-200 disabled:opacity-50 hover:shadow-md transform hover:scale-105"
                  title="Refresh preview"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => window.open(project.previewUrl, '_blank')}
                  className="p-2 glassmorphic-card border border-white/30 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-sakura-500 dark:hover:text-sakura-400 rounded-lg transition-all duration-200 hover:shadow-md transform hover:scale-105"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Preview Content */}
      <div className="flex-1 relative overflow-hidden bg-white dark:bg-gray-900">
        {project.status === 'running' && project.previewUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={project.previewUrl}
              className="w-full h-full border-0 bg-white"
              title="Project Preview"
              onLoad={() => setIsRefreshing(false)}
            />
            {isRefreshing && (
              <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 flex items-center justify-center z-20 glassmorphic backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-sakura-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    Refreshing preview...
                  </span>
                </div>
              </div>
            )}
          </>
        ) : project.status === 'idle' ? (
          /* Start Project State */
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                <Monitor className="w-10 h-10 text-sakura-600 dark:text-sakura-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
                Ready to Preview
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Start your project to see a live preview of your application. Your changes will be reflected in real-time.
              </p>
              <button
                onClick={() => onStartProject(project)}
                disabled={isStarting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sakura-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl shadow-sakura-500/25 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    <span>Start Project</span>
                  </>
                )}
              </button>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-4">
                <Eye className="w-4 h-4" />
                <span>Live reload enabled</span>
              </div>
            </div>
          </div>
        ) : (
          /* Loading/Error State */
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Zap className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
                {project.status === 'error' ? 'Preview Error' : 'Getting Ready...'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {project.status === 'error' 
                  ? 'There was an issue starting the preview. Please check the terminal for more details.'
                  : 'Your project is being prepared for preview. This may take a moment.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPane; 