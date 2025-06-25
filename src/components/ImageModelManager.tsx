import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Download, Settings, Star, Eye, Heart, Filter, RefreshCw, Key, X, CheckCircle, HardDrive, ImageIcon, Calendar, Trash2 } from 'lucide-react';

// Simple HTML sanitizer to prevent XSS while allowing basic formatting
const sanitizeHTML = (html: string): string => {
  // Basic sanitization - remove script tags and dangerous attributes
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
  
  // Ensure external links open in new tab and have proper rel attributes
  sanitized = sanitized.replace(/<a\s+([^>]*href="[^"]*"[^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes('target=')) {
      attrs += ' target="_blank"';
    }
    if (!attrs.includes('rel=')) {
      attrs += ' rel="noopener noreferrer"';
    }
    return `<a ${attrs}>`;
  });
  
  return sanitized;
};

// CivitAI Model Interfaces
interface ModelInfo {
  id: string;
  name: string;
  description: string;
  creator: string;
  type: 'checkpoint' | 'lora' | 'vae' | 'controlnet' | 'upscaler' | 'embedding';
  tags: string[];
  stats: {
    downloads: number;
    likes: number;
    rating: number;
  };
  images: string[];
  versions: ModelVersion[];
  source: 'civitai';
  nsfw: boolean;
}

interface ModelVersion {
  id: string;
  name: string;
  baseModel: string;
  files: ModelFile[];
  downloadUrl?: string;
}

interface ModelFile {
  name: string;
  url: string;
  sizeKB: number;
  type: string;
  metadata: {
    fp?: string;
    size?: string;
    format?: string;
  };
}

interface DownloadProgress {
  filename?: string;
  fileName?: string; // Support both naming conventions
  progress: number;
  downloadedSize: number;
  totalSize: number;
  speed?: string;
  eta?: string;
  error?: string;
  completed?: boolean;
  modelType?: string;
}

interface ApiKeys {
  civitai?: string;
}

interface ImageModelManagerProps {
  onClose: () => void;
}

const ImageModelManager: React.FC<ImageModelManagerProps> = ({ onClose }) => {
  // State
  const [activeTab, setActiveTab] = useState<'discover' | 'library'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('Highest Rated');
  const [searchResults, setSearchResults] = useState<ModelInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [showNSFW, setShowNSFW] = useState(false);
  const [localModels, setLocalModels] = useState<Record<string, any[]>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);

  const modelTypes = [
    { value: 'checkpoint', label: 'Checkpoint', civitai: 'Checkpoint' },
    { value: 'lora', label: 'LoRA', civitai: 'LORA' },
    { value: 'vae', label: 'VAE', civitai: 'VAE' },
    { value: 'controlnet', label: 'ControlNet', civitai: 'Controlnet' },
    { value: 'upscaler', label: 'Upscaler', civitai: 'Upscaler' },
    { value: 'embedding', label: 'Embedding', civitai: 'TextualInversion' }
  ];

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      await loadApiKeys();
      await loadLocalModels();
    };
    
    loadData();
    
    // Set up download progress listeners for CivitAI
    const unsubscribeProgress = window.modelManager?.onComfyUILocalDownloadProgress?.(handleDownloadProgress);
    const unsubscribeComplete = window.modelManager?.onComfyUILocalDownloadComplete?.(handleDownloadComplete);
    
    return () => {
      unsubscribeProgress?.();
      unsubscribeComplete?.();
    };
  }, []);

  const loadApiKeys = useCallback(async () => {
    try {
      const keys = await window.modelManager?.getApiKeys?.();
      setApiKeys(keys || {});
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  }, []);

  const saveApiKeys = useCallback(async (keys: ApiKeys) => {
    try {
      await window.modelManager?.saveApiKeys?.(keys);
      setApiKeys(keys);
    } catch (error) {
      console.error('Failed to save API keys:', error);
    }
  }, []);

  const loadLocalModels = useCallback(async () => {
    try {
      // Load models from all categories using the new local system
      const categories = ['checkpoints', 'loras', 'vae', 'controlnet', 'upscale_models', 'embeddings'];
      const allModels: Record<string, any[]> = {};
      
      for (const category of categories) {
        try {
          const result = await window.modelManager?.comfyuiLocalListModels?.(category);
          if (result?.success) {
            allModels[category] = result.models || [];
          } else {
            allModels[category] = [];
          }
        } catch (error) {
          console.error(`Failed to load ${category} models:`, error);
          allModels[category] = [];
        }
      }
      
      setLocalModels(allModels);
    } catch (error) {
      console.error('Failed to load local models:', error);
    }
  }, []);

  const handleDownloadProgress = (progress: DownloadProgress) => {
    setDownloads(prev => {
      const filename = progress.filename || progress.fileName || '';
      const existing = prev.find(d => (d.filename || d.fileName) === filename);
      if (existing) {
        return prev.map(d => (d.filename || d.fileName) === filename ? { ...d, ...progress } : d);
      } else {
        return [...prev, progress];
      }
    });
  };

  const handleDownloadComplete = (data: { filename: string; category: string; localPath: string; containerPath: string; size: number }) => {
    setDownloads(prev => 
      prev.map(d => 
        (d.filename || d.fileName) === data.filename 
          ? { ...d, completed: true, progress: 100, modelType: data.category }
          : d
      )
    );
    
    console.log(`✅ Model downloaded to persistent storage: ${data.filename} -> ${data.localPath}`);
    
    // Refresh local models after successful download
    setTimeout(() => {
      loadLocalModels();
    }, 1000);
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      let results: any[] = [];
      
      const civitaiTypes = selectedTypes.map(type => {
        const modelType = modelTypes.find(mt => mt.value === type);
        return modelType?.civitai || type;
      });
      
      const response = await window.modelManager?.searchCivitAI?.(
        searchQuery,
        civitaiTypes,
        sortBy
      );
      
      if (response?.items) {
        results = response.items.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          description: item.description || '',
          creator: item.creator?.username || 'Unknown',
          type: item.type?.toLowerCase() === 'textualinversion' ? 'embedding' : item.type?.toLowerCase() || 'checkpoint',
          tags: item.tags || [],
          stats: {
            downloads: item.stats?.downloadCount || 0,
            likes: item.stats?.favoriteCount || 0,
            rating: item.stats?.rating || 0
          },
          images: item.modelVersions?.[0]?.images?.map((img: any) => img.url) || [],
          versions: item.modelVersions?.map((version: any) => ({
            id: version.id.toString(),
            name: version.name,
            baseModel: version.baseModel || '',
            files: version.files?.map((file: any) => ({
              name: file.name,
              url: file.downloadUrl,
              sizeKB: Math.round((file.sizeKB || 0)),
              type: file.type || '',
              metadata: {
                fp: file.metadata?.fp,
                size: file.metadata?.size,
                format: file.metadata?.format
              }
            })) || []
          })) || [],
          source: 'civitai' as const,
          nsfw: item.nsfw || false
        })).filter((model: ModelInfo) => showNSFW || !model.nsfw);
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedTypes, sortBy, showNSFW]);

  const handleDownload = useCallback(async (model: ModelInfo, version: ModelVersion, file: ModelFile) => {
    try {
      const progress: DownloadProgress = {
        filename: file.name,
        progress: 0,
        downloadedSize: 0,
        totalSize: file.sizeKB * 1024,
        modelType: model.type
      };
      
      setDownloads(prev => [...prev, progress]);
      
      await window.modelManager?.comfyuiLocalDownloadModel?.(
        file.url,
        file.name,
        model.type === 'checkpoint' ? 'checkpoints' :
          model.type === 'lora' ? 'loras' :
        model.type === 'vae' ? 'vae' :
        model.type === 'controlnet' ? 'controlnet' :
        model.type === 'upscaler' ? 'upscale_models' :
        model.type === 'embedding' ? 'embeddings' : 'checkpoints'
      );
      
      console.log(`Started download: ${file.name} (${model.type})`);
    } catch (error) {
      console.error('Download failed:', error);
      
      setDownloads(prev => 
        prev.map(d => 
          (d.filename || d.fileName) === file.name 
            ? { ...d, error: error instanceof Error ? error.message : 'Download failed' }
            : d
        )
      );
    }
  }, []);

  const handleDeleteModel = useCallback(async (modelType: string, filename: string) => {
    try {
      await window.modelManager?.comfyuiLocalDeleteModel?.(filename, modelType);
      loadLocalModels();
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  }, []);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const formatBytes = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const getModelTypeDisplayName = useCallback((type: string) => {
    const typeMap: Record<string, string> = {
      'checkpoints': 'Checkpoints',
      'loras': 'LoRAs', 
      'vae': 'VAEs',
      'controlnet': 'ControlNet',
      'upscale_models': 'Upscalers',
      'embeddings': 'Embeddings'
    };
    return typeMap[type] || type;
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <style>{`
        .model-description {
          line-height: 1.6;
        }
        .model-description p {
          margin-bottom: 0.75rem;
        }
        .model-description p:last-child {
          margin-bottom: 0;
        }
        .model-description strong, .model-description b {
          font-weight: 600;
          color: inherit;
        }
        .model-description a {
          color: #a855f7;
          text-decoration: underline;
          transition: color 0.2s;
        }
        .model-description a:hover {
          color: #9333ea;
        }
        .dark .model-description a {
          color: #c084fc;
        }
        .dark .model-description a:hover {
          color: #d8b4fe;
        }
      `}</style>
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl w-full max-w-7xl h-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shadow-md">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Model Manager
            </h2>
            <div className="flex space-x-1 ml-6">
              <button
                onClick={() => setActiveTab('discover')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'discover'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'
                }`}
              >
                Discover
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'library'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'
                }`}
              >
                Library
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowApiKeys(!showApiKeys)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30"
              title="API Settings"
            >
              <Key className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Keys Panel */}
        {showApiKeys && (
          <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-gray-200/50 dark:border-gray-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md">
                <Key className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API Configuration</h3>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-4 rounded-xl max-w-md shadow-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">CivitAI API Key (Optional)</label>
              <input
                type="password"
                value={apiKeys.civitai || ''}
                onChange={(e) => setApiKeys(prev => ({ ...prev, civitai: e.target.value }))}
                onBlur={() => saveApiKeys(apiKeys)}
                placeholder="For higher rate limits and NSFW content access"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600/30 rounded-lg bg-white/80 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Get your API key from <a href="https://civitai.com/user/account" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 hover:underline">CivitAI Account Settings</a>
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-gray-50/50 to-purple-50/30 dark:from-gray-900/20 dark:to-purple-900/10">
          {activeTab === 'discover' ? (
            <div className="h-full flex flex-col">
              {/* Search Interface */}
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/30">
                <div className="flex flex-col space-y-6">
                  {/* Search Bar */}
                  <div className="flex space-x-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-500 dark:text-purple-400 w-5 h-5" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search for models on CivitAI..."
                        className="w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-gray-600/30 rounded-xl bg-white/80 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm transition-all duration-200 text-lg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={isSearching}
                      className="px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {isSearching ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                      <span className="font-medium">Search</span>
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-4 rounded-xl shadow-sm">
                    <div className="flex flex-wrap items-center gap-6">
                      {/* Model Type Selection */}
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Filter className="w-4 h-4" />
                          Types:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {modelTypes.map((type) => (
                            <label key={type.value} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700/70 border border-gray-200/50 dark:border-gray-600/30 transition-all duration-200 cursor-pointer shadow-sm">
                              <input
                                type="checkbox"
                                checked={selectedTypes.includes(type.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTypes([...selectedTypes, type.value]);
                                  } else {
                                    setSelectedTypes(selectedTypes.filter(t => t !== type.value));
                                  }
                                }}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{type.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Sort */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sort:</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600/30 rounded-lg bg-white/80 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm transition-all duration-200 shadow-sm"
                        >
                          <option value="Highest Rated">Highest Rated</option>
                          <option value="Most Downloaded">Most Downloaded</option>
                          <option value="Newest">Newest</option>
                        </select>
                      </div>

                      {/* NSFW Toggle */}
                      <label className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/80 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700/70 border border-gray-200/50 dark:border-gray-600/30 transition-all duration-200 cursor-pointer shadow-sm">
                        <input
                          type="checkbox"
                          checked={showNSFW}
                          onChange={(e) => setShowNSFW(e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show NSFW</span>
                        <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-hidden flex">
                {/* Model List */}
                <div className="w-1/2 border-r border-gray-200/50 dark:border-gray-700/30 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center p-12">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <RefreshCw className="w-8 h-8 animate-spin text-white" />
                      </div>
                      <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Searching CivitAI...</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 mt-1">Finding the best models for you</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-3 p-6">
                      {searchResults.map((model) => (
                        <div
                          key={model.id}
                          onClick={() => setSelectedModel(model)}
                          className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg shadow-sm ${
                            selectedModel?.id === model.id
                              ? 'ring-2 ring-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30'
                              : 'hover:bg-white/90 dark:hover:bg-gray-800/90'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {model.images[0] && (
                              <div className="relative flex-shrink-0">
                                <img
                                  src={model.images[0]}
                                  alt={model.name}
                                  className="w-20 h-20 object-cover rounded-xl shadow-md"
                                />
                                {model.nsfw && (
                                  <div className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                                    <Eye className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white truncate text-lg">{model.name}</h3>
                              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">by {model.creator}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                                  model.type === 'checkpoint' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                  model.type === 'lora' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                  model.type === 'vae' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                }`}>
                                  {model.type.toUpperCase()}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                  <Download className="w-3 h-3" />
                                  <span className="font-medium">{model.stats.downloads.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                  <Heart className="w-3 h-3 text-red-500" />
                                  <span className="font-medium">{model.stats.likes.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                  <Star className="w-3 h-3 text-yellow-500" />
                                  <span className="font-medium">{model.stats.rating.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <Search className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {searchQuery ? 'No models found' : 'Ready to search'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {searchQuery ? 'Try a different search term or adjust your filters.' : 'Enter a search term to discover amazing AI models.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Model Details */}
                <div className="w-1/2 overflow-y-auto bg-gradient-to-br from-gray-50/30 to-purple-50/20 dark:from-gray-900/10 dark:to-purple-900/5">
                  {selectedModel ? (
                    <div className="p-6 space-y-6">
                      {/* Model Info Header */}
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-6 rounded-xl shadow-sm">
                        <div className="flex items-start gap-4">
                          {selectedModel.images[0] && (
                            <img
                              src={selectedModel.images[0]}
                              alt={selectedModel.name}
                              className="w-24 h-24 object-cover rounded-xl shadow-lg flex-shrink-0"
                            />
                          )}
                          <div className="flex-1">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{selectedModel.name}</h2>
                            <p className="text-lg text-purple-600 dark:text-purple-400 font-medium mb-3">by {selectedModel.creator}</p>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
                                selectedModel.type === 'checkpoint' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                selectedModel.type === 'lora' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                selectedModel.type === 'vae' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {selectedModel.type.toUpperCase()}
                              </span>
                              <div className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-gray-700/50 rounded-full border border-gray-200/50 dark:border-gray-600/30 shadow-sm">
                                <Download className="w-4 h-4 text-blue-500" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedModel.stats.downloads.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-gray-700/50 rounded-full border border-gray-200/50 dark:border-gray-600/30 shadow-sm">
                                <Heart className="w-4 h-4 text-red-500" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedModel.stats.likes.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-gray-700/50 rounded-full border border-gray-200/50 dark:border-gray-600/30 shadow-sm">
                                <Star className="w-4 h-4 text-yellow-500" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedModel.stats.rating.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/30">
                          <div 
                            className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none model-description"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(selectedModel.description) }}
                          />
                        </div>
                      </div>

                      {/* Versions and Downloads */}
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-6 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md">
                            <Download className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Available Versions</h3>
                          <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium shadow-sm">
                            {selectedModel.versions.length} versions
                          </span>
                        </div>
                        <div className="space-y-4">
                          {selectedModel.versions.map((version) => (
                            <div key={version.id} className="bg-white/80 dark:bg-gray-700/50 backdrop-blur-sm p-4 rounded-xl border border-gray-200/50 dark:border-gray-600/30 shadow-sm">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white text-lg">{version.name}</h4>
                                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Base Model: {version.baseModel}</p>
                                </div>
                              </div>
                              
                              {/* Files */}
                              <div className="space-y-3">
                                {version.files.map((file, fileIndex) => {
                                  const downloadProgress = downloads.find(d => (d.filename || d.fileName) === file.name);
                                  const isDownloading = downloadProgress && !downloadProgress.completed;
                                  const isCompleted = downloadProgress && downloadProgress.completed;
                                  
                                  return (
                                    <div key={fileIndex} className="flex items-center justify-between p-4 bg-white/90 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-600/30 shadow-sm">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{file.name}</span>
                                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium shadow-sm">
                                            {formatBytes(file.sizeKB * 1024)}
                                          </span>
                                          {file.metadata.fp && (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs font-semibold shadow-sm">
                                              {file.metadata.fp}
                                            </span>
                                          )}
                                        </div>
                                        {isDownloading && (
                                          <div className="mt-2">
                                            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
                                              <span className="font-medium">{Math.round(downloadProgress.progress)}%</span>
                                              {downloadProgress.speed && <span>{downloadProgress.speed}</span>}
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                              <div 
                                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${downloadProgress.progress}%` }}
                                              />
                                            </div>
                                          </div>
                                        )}
                                        {downloadProgress?.error && (
                                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
                                            <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                                              Error: {downloadProgress.error}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(selectedModel, version, file);
                                        }}
                                        disabled={isDownloading}
                                        className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 shadow-sm ${
                                          isCompleted
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 shadow-md'
                                            : isDownloading
                                            ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                                        }`}
                                      >
                                        {isCompleted ? (
                                          <>
                                            <CheckCircle className="w-4 h-4" />
                                            <span>Downloaded</span>
                                          </>
                                        ) : isDownloading ? (
                                          <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Downloading</span>
                                          </>
                                        ) : (
                                          <>
                                            <Download className="w-4 h-4" />
                                            <span>Download</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-12">
                      <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-6 shadow-lg">
                        <Settings className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Select a Model</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                        Choose a model from the list to view detailed information, sample images, and download options.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Library Tab */
            <div className="h-full p-6">
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-6 rounded-xl mb-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shadow-md">
                      <HardDrive className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Local Models</h3>
                  </div>
                  <button
                    onClick={loadLocalModels}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="font-medium">Refresh</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                {Object.entries(localModels).map(([modelType, models]) => (
                  models.length > 0 && (
                    <div key={modelType} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-6 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md`}>
                          <HardDrive className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                          {getModelTypeDisplayName(modelType)}
                        </h4>
                        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium shadow-sm">
                          {models.length} models
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {models.map((model, index) => (
                          <div key={`${modelType}-${model.name}-${index}`} className="flex items-center justify-between p-4 bg-white/90 dark:bg-gray-700/50 rounded-lg border border-gray-200/50 dark:border-gray-600/30 hover:bg-white dark:hover:bg-gray-700/70 transition-all duration-200 shadow-sm">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white text-lg">{model.name}</h5>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2">
                                  <HardDrive className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{formatBytes(model.size)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {new Date(model.modified).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteModel(modelType, model.name);
                              }}
                              className="px-4 py-2 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all duration-200 font-medium flex items-center gap-2 shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                
                {Object.values(localModels).every(models => models.length === 0) && (
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/50 dark:border-gray-600/30 p-12 rounded-xl text-center shadow-sm">
                    <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <HardDrive className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Local Models</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Download models from the Discover tab to see them here
                    </p>
                    <button
                      onClick={() => setActiveTab('discover')}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                    >
                      Browse Models
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageModelManager; 