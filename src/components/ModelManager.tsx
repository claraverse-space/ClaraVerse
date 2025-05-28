import React, { useState, useEffect } from 'react';
import { Download, Search, Trash2, HardDrive, Cloud } from 'lucide-react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

// Define types for model management
interface HuggingFaceModel {
  id: string;
  name: string;
  downloads: number;
  likes: number;
  tags: string[];
  description: string;
  author: string;
  files: Array<{ rfilename: string; size?: number }>;
}

interface LocalModel {
  name: string;
  file: string;
  path: string;
  size: number;
  source: string;
  lastModified: Date;
}

interface DownloadProgress {
  fileName: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
}

// ModelCard Component for Search Results
interface ModelCardProps {
  model: HuggingFaceModel;
  onDownload: (modelId: string, fileName: string) => void;
  downloading: Set<string>;
  downloadProgress: { [fileName: string]: DownloadProgress };
  formatFileSize: (bytes: number) => string;
  onTagClick?: (tag: string) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({ model, onDownload, downloading, downloadProgress, formatFileSize, onTagClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="bg-white/30 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center dark:text-white text-pink-600 font-bold text-lg">
          {model.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h5 className="font-semibold text-gray-900 dark:text-white">{model.name}</h5>
              <p className="text-sm text-gray-600 dark:text-gray-300">by {model.author}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {model.downloads.toLocaleString()}
              </span>
              <span>♥ {model.likes.toLocaleString()}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{model.description}</p>
          
          {/* Tags */}
          {model.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {model.tags.slice(0, 5).map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagClick?.(tag)}
                  className="px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 text-xs rounded hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
              {model.tags.length > 5 && (
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded">
                  +{model.tags.length - 5} more
                </span>
              )}
            </div>
          )}
          
          {/* Files Section */}
          {model.files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Available Downloads ({model.files.length})
                </span>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-sakura-600 dark:text-sakura-400 hover:text-sakura-700 dark:hover:text-sakura-300 transition-colors"
                >
                  {isExpanded ? 'Show Less' : 'Show Files'}
                  <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </button>
              </div>
              
              {/* Show first file always */}
              {model.files.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{model.files[0].rfilename}</span>
                      {model.files[0].size && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Size: {formatFileSize(model.files[0].size)}
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      {downloading.has(model.files[0].rfilename) ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin"></div>
                          {downloadProgress[model.files[0].rfilename] && (
                            <span className="text-xs text-sakura-600 dark:text-sakura-400">
                              {downloadProgress[model.files[0].rfilename].progress}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          data-tour="model-download-btn"
                          onClick={() => onDownload(model.id, model.files[0].rfilename)}
                          className="px-3 py-1 bg-sakura-500 text-white text-xs rounded-lg hover:bg-sakura-600 transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Collapsible additional files */}
              {isExpanded && model.files.length > 1 && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  {model.files.slice(1).map((file) => (
                    <div key={file.rfilename} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{file.rfilename}</span>
                          {file.size && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Size: {formatFileSize(file.size)}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          {downloading.has(file.rfilename) ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin"></div>
                              {downloadProgress[file.rfilename] && (
                                <span className="text-xs text-sakura-600 dark:text-sakura-400">
                                  {downloadProgress[file.rfilename].progress}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => onDownload(model.id, file.rfilename)}
                              className="px-3 py-1 bg-sakura-500 text-white text-xs rounded-lg hover:bg-sakura-600 transition-colors flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ModelManager: React.FC = () => {
  // Model manager state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HuggingFaceModel[]>([]);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ [fileName: string]: DownloadProgress }>({});
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [modelManagerTab, setModelManagerTab] = useState<'discover' | 'library'>('discover');

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const tourSteps: Step[] = [
    {
      target: '[data-tour="search-bar"]',
      content: (
        <div className="text-sakura-600 dark:text-sakura-300">
          <b>Search for Models</b><br />
          Type a model name or keyword here to discover amazing AI models!
        </div>
      ),
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '[data-tour="search-btn"]',
      content: (
        <div className="text-sakura-600 dark:text-sakura-300">
          <b>Find Models</b><br />
          Click here to search HuggingFace for models matching your query.
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="model-download-btn"]',
      content: (
        <div className="text-sakura-600 dark:text-sakura-300">
          <b>Download a Model</b><br />
          Click this button to download a model to your library. Try it out!
        </div>
      ),
      placement: 'left',
    },
    {
      target: '[data-tour="library-tab"]',
      content: (
        <div className="text-sakura-600 dark:text-sakura-300">
          <b>My Library</b><br />
          View and manage all your downloaded models here.
        </div>
      ),
      placement: 'bottom',
    },
  ];

  // Load local models on mount and set up download progress listener
  useEffect(() => {
    const loadLocalModels = async () => {
      if (window.modelManager?.getLocalModels) {
        try {
          const result = await window.modelManager.getLocalModels();
          if (result.success) {
            setLocalModels(result.models);
          }
        } catch (error) {
          console.error('Error loading local models:', error);
        }
      }
    };

    loadLocalModels();

    // Set up download progress listener
    let unsubscribe: (() => void) | undefined;
    if (window.modelManager?.onDownloadProgress) {
      unsubscribe = window.modelManager.onDownloadProgress((data: DownloadProgress) => {
        setDownloadProgress(prev => ({
          ...prev,
          [data.fileName]: data
        }));
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('modelManagerOnboardingComplete')) {
      setShowOnboarding(true);
    }
  }, []);

  // Model management functions
  const searchModels = async () => {
    if (!searchQuery.trim() || !window.modelManager?.searchHuggingFaceModels) return;
    
    setIsSearching(true);
    try {
      const result = await window.modelManager.searchHuggingFaceModels(searchQuery, 20);
      if (result.success) {
        setSearchResults(result.models);
      } else {
        console.error('Search failed:', result.error);
      }
    } catch (error) {
      console.error('Error searching models:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle tag filtering
  const handleTagFilter = async (tag: string) => {
    if (!window.modelManager?.searchHuggingFaceModels) return;
    
    setIsSearching(true);
    setSearchQuery(tag);
    
    try {
      const result = await window.modelManager.searchHuggingFaceModels(tag, 20);
      if (result.success) {
        setSearchResults(result.models);
      }
    } catch (error) {
      console.error('Error filtering by tag:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const downloadModel = async (modelId: string, fileName: string) => {
    if (!window.modelManager?.downloadModel) return;
    
    setDownloading(prev => new Set([...prev, fileName]));
    try {
      const result = await window.modelManager.downloadModel(modelId, fileName);
      if (result.success) {
        // Refresh local models
        const localResult = await window.modelManager.getLocalModels();
        if (localResult.success) {
          setLocalModels(localResult.models);
        }
      } else {
        console.error('Download failed:', result.error);
      }
    } catch (error) {
      console.error('Error downloading model:', error);
    } finally {
      setDownloading(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
      
      // Clean up progress
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });
    }
  };

  const deleteLocalModel = async (filePath: string) => {
    if (!window.modelManager?.deleteLocalModel) return;
    
    try {
      // Add to deleting set
      setDeleting(prev => new Set([...prev, filePath]));
      
      const result = await window.modelManager.deleteLocalModel(filePath);
      if (result.success) {
        // Refresh local models
        const localResult = await window.modelManager.getLocalModels();
        if (localResult.success) {
          setLocalModels(localResult.models);
        }
      } else {
        console.error('Delete failed:', result.error);
      }
    } catch (error) {
      console.error('Error deleting model:', error);
    } finally {
      // Remove from deleting set
      setDeleting(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <>
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center border border-sakura-100 dark:border-sakura-900/40 relative animate-in fade-in duration-300">
            <div className="text-5xl mb-4 select-none">🦙✨</div>
            <h2 className="text-2xl font-bold mb-2 text-sakura-600 dark:text-sakura-300">Welcome to Model Manager!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-base">
              Discover, download, and manage AI models with ease.<br />Let's take a quick tour to get you started!
            </p>
            <button
              className="px-6 py-2 bg-sakura-500 text-white rounded-lg font-semibold hover:bg-sakura-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-sakura-300"
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem('modelManagerOnboardingComplete', 'true');
                setRunTour(true);
              }}
            >
              Get Started
            </button>
            <button
              className="block mt-4 text-sm text-gray-400 hover:text-sakura-500 dark:hover:text-sakura-300 transition-colors mx-auto"
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem('modelManagerOnboardingComplete', 'true');
              }}
            >
              Skip
            </button>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-2 bg-sakura-200 dark:bg-sakura-900/40 rounded-full blur-sm opacity-60" />
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Header with Tabs */}
        <div className="glassmorphic rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <HardDrive className="w-6 h-6 text-sakura-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Model Manager
            </h2>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
            <button
              onClick={() => setModelManagerTab('discover')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                modelManagerTab === 'discover'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Discover Models
            </button>
            <button
              data-tour="library-tab"
              onClick={() => setModelManagerTab('library')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                modelManagerTab === 'library'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              My Library ({localModels.length})
            </button>
          </div>

          {/* Discover Tab Content */}
          {modelManagerTab === 'discover' && (
            <>
              {/* Search Section - Moved to Top */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-5 h-5 text-sakura-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Search Models
                  </h3>
                </div>
                
                <div className="flex gap-2 mb-6">
                  <input
                    data-tour="search-bar"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchModels()}
                    placeholder="Search for models (e.g., 'llama', 'qwen', 'phi')"
                    className="flex-1 px-4 py-3 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  />
                  <button
                    data-tour="search-btn"
                    onClick={searchModels}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-6 py-3 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white">Search Results</h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{searchResults.length} models found</span>
                    </div>
                    <div className="grid gap-4 max-h-[600px] overflow-y-auto">
                      {searchResults.map((model) => (
                        <ModelCard key={model.id} model={model} onDownload={downloadModel} downloading={downloading} downloadProgress={downloadProgress} formatFileSize={formatFileSize} onTagClick={handleTagFilter} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Library Tab Content */}
          {modelManagerTab === 'library' && (
            <div className="glassmorphic rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Your Model Library
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>Total Storage: {localModels.reduce((acc, model) => acc + model.size, 0) > 0 ? formatFileSize(localModels.reduce((acc, model) => acc + model.size, 0)) : '0 B'}</span>
                </div>
              </div>
              
              {localModels.length > 0 ? (
                <div className="grid gap-3">
                  {localModels.map((model) => (
                    <div key={model.path} className="flex items-center gap-4 p-4 bg-white/30 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center text-white">
                        <HardDrive className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900 dark:text-white">{model.name}</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">{model.file}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatFileSize(model.size)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Cloud className="w-3 h-3" />
                            {model.source}
                          </span>
                          <span>Added {new Date(model.lastModified).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                          Active
                        </span>
                        {deleting.has(model.path) ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white text-xs rounded-lg opacity-50 cursor-not-allowed">
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Removing...
                          </div>
                        ) : (
                          <button
                            onClick={() => deleteLocalModel(model.path)}
                            disabled={deleting.has(model.path)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove model"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HardDrive className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No models in your library</h4>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Download models from the Discover tab to get started
                  </p>
                  <button 
                    onClick={() => setModelManagerTab('discover')}
                    className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors"
                  >
                    Discover Models
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Joyride Tour */}
      <Joyride
        steps={tourSteps}
        run={runTour}
        stepIndex={tourStepIndex}
        continuous
        showSkipButton
        showProgress
        styles={{
          options: {
            primaryColor: '#ec4899',
            textColor: '#374151',
            backgroundColor: '#ffffff',
            overlayColor: 'rgba(0, 0, 0, 0.4)',
            arrowColor: '#ffffff',
            zIndex: 1000,
          },
          tooltip: {
            borderRadius: 12,
            fontSize: 14,
          },
          buttonNext: {
            backgroundColor: '#ec4899',
            borderRadius: 8,
            fontSize: 14,
            padding: '8px 16px',
          },
          buttonBack: {
            color: '#6b7280',
            marginRight: 'auto',
          },
          buttonSkip: {
            color: '#6b7280',
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip Tour',
        }}
        callback={(data: CallBackProps) => {
          const { status, index, type } = data;
          if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRunTour(false);
            setTourStepIndex(0);
          } else if (type === 'step:after' || type === 'error:target_not_found') {
            setTourStepIndex((index ?? 0) + 1);
          } else if (type === 'step:before') {
            setTourStepIndex(index ?? 0);
          }
        }}
      />
    </>
  );
};

export default ModelManager; 