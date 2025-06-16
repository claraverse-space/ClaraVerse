import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, Settings, Star, Eye, Heart, Filter, RefreshCw, Key, X, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';

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
  source: 'civitai' | 'huggingface';
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
  filename: string;
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
  huggingface?: string;
}

const ModelManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'library'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<'civitai' | 'huggingface'>('civitai');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('Highest Rated');
  const [searchResults, setSearchResults] = useState<ModelInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [showNSFW, setShowNSFW] = useState(false);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [localModels, setLocalModels] = useState<Record<string, any[]>>({});
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [showApiKeys, setShowApiKeys] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const modelTypes = [
    { value: 'checkpoint', label: 'Checkpoint', civitai: 'Checkpoint', hf: 'text-to-image' },
    { value: 'lora', label: 'LoRA', civitai: 'LORA', hf: 'lora' },
    { value: 'vae', label: 'VAE', civitai: 'VAE', hf: 'vae' },
    { value: 'controlnet', label: 'ControlNet', civitai: 'Controlnet', hf: 'controlnet' },
    { value: 'upscaler', label: 'Upscaler', civitai: 'Upscaler', hf: 'upscaler' },
    { value: 'embedding', label: 'Embedding', civitai: 'TextualInversion', hf: 'textual_inversion' }
  ];

  // Load API keys on mount
  useEffect(() => {
    loadApiKeys();
    loadLocalModels();
    
    // Set up download progress listeners for new local system
    const unsubscribeProgress = window.modelManager?.onComfyUILocalDownloadProgress?.(handleDownloadProgress);
    const unsubscribeComplete = window.modelManager?.onComfyUILocalDownloadComplete?.(handleDownloadComplete);
    
    return () => {
      unsubscribeProgress?.();
      unsubscribeComplete?.();
    };
  }, []);

  const loadApiKeys = async () => {
    try {
      const keys = await window.modelManager?.getApiKeys?.();
      setApiKeys(keys || {});
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const saveApiKeys = async (keys: ApiKeys) => {
    try {
      await window.modelManager?.saveApiKeys?.(keys);
      setApiKeys(keys);
    } catch (error) {
      console.error('Failed to save API keys:', error);
    }
  };

  const loadLocalModels = async () => {
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
  };

  const handleDownloadProgress = (progress: DownloadProgress) => {
    setDownloads(prev => {
      const existing = prev.find(d => d.filename === progress.filename);
      if (existing) {
        return prev.map(d => d.filename === progress.filename ? { ...d, ...progress } : d);
      } else {
        return [...prev, progress];
      }
    });
  };

  const handleDownloadComplete = (data: { filename: string; category: string; localPath: string; containerPath: string; size: number }) => {
    setDownloads(prev => 
      prev.map(d => 
        d.filename === data.filename 
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      let results: any[] = [];
      
      if (selectedSource === 'civitai') {
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
            images: item.images?.slice(0, 3).map((img: any) => img.url) || [],
            versions: item.modelVersions?.map((version: any) => ({
              id: version.id.toString(),
              name: version.name,
              baseModel: version.baseModel || 'Unknown',
              files: version.files?.map((file: any) => ({
                name: file.name,
                url: file.downloadUrl,
                sizeKB: Math.round((file.sizeKB || 0)),
                type: file.type || 'Model',
                metadata: file.metadata || {}
              })) || []
            })) || [],
            source: 'civitai' as const,
            nsfw: item.nsfw || false
          }));
        }
      } else if (selectedSource === 'huggingface') {
        const response = await window.modelManager?.searchHuggingFace?.(
          searchQuery,
          selectedTypes[0],
          undefined
        );
        
        if (Array.isArray(response)) {
          results = response.map((item: any) => ({
            id: item.id,
            name: item.id.split('/').pop() || item.id,
            description: item.cardData?.title || item.pipeline_tag || '',
            creator: item.id.split('/')[0] || 'Unknown',
            type: 'checkpoint' as const,
            tags: item.tags || [],
            stats: {
              downloads: item.downloads || 0,
              likes: item.likes || 0,
              rating: 0
            },
            images: [],
            versions: [{
              id: 'main',
              name: 'Main',
              baseModel: 'Unknown',
              files: [] // Would need additional API call to get files
            }],
            source: 'huggingface' as const,
            nsfw: false
          }));
        }
      }
      
      // Filter NSFW content if needed
      if (!showNSFW) {
        results = results.filter(model => !model.nsfw);
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setIsSearching(false);
  };

  const handleDownload = async (model: ModelInfo, version: ModelVersion, file: ModelFile) => {
    try {
      const apiKey = model.source === 'civitai' ? apiKeys.civitai : apiKeys.huggingface;
      
      // Check if file is already downloading
      const isDownloading = downloads.some(d => d.filename === file.name && !d.completed);
      if (isDownloading) {
        console.log('File is already downloading:', file.name);
        return;
      }

      // Start the download using new local persistent storage system
      await window.modelManager?.comfyuiLocalDownloadModel?.(
        file.url,
        file.name,
        model.type === 'lora' ? 'loras' : 
        model.type === 'checkpoint' ? 'checkpoints' :
        model.type === 'vae' ? 'vae' :
        model.type === 'controlnet' ? 'controlnet' :
        model.type === 'upscaler' ? 'upscale_models' :
        model.type === 'embedding' ? 'embeddings' : 'checkpoints'
      );
      
      console.log(`Started download: ${file.name} (${model.type})`);
    } catch (error) {
      console.error('Download failed:', error);
      
      // Update download state with error
      setDownloads(prev => 
        prev.map(d => 
          d.filename === file.name 
            ? { ...d, error: error instanceof Error ? error.message : 'Download failed' }
            : d
        )
      );
    }
  };

  const handleDeleteModel = async (modelType: string, filename: string) => {
    try {
      await window.modelManager?.comfyuiLocalDeleteModel?.(filename, modelType);
      loadLocalModels();
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getModelTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      'checkpoints': 'Checkpoints',
      'loras': 'LoRAs', 
      'vae': 'VAEs',
      'controlnet': 'ControlNet',
      'upscale_models': 'Upscalers',
      'embeddings': 'Embeddings',
      'hypernetworks': 'Hypernetworks',
      'style_models': 'Style Models',
      't2i_adapter': 'T2I Adapter',
      'clip': 'CLIP',
      'unet': 'UNet'
    };
    return typeMap[type] || type;
  };

  return (
    <>
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
          color: #3b82f6;
          text-decoration: underline;
          transition: color 0.2s;
        }
        .model-description a:hover {
          color: #1d4ed8;
        }
        .dark .model-description a {
          color: #60a5fa;
        }
        .dark .model-description a:hover {
          color: #93c5fd;
        }
        .model-description ul, .model-description ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }
        .model-description li {
          margin-bottom: 0.25rem;
        }
        .model-description code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .dark .model-description code {
          background-color: #374151;
        }
        .model-description h1, .model-description h2, .model-description h3, .model-description h4, .model-description h5, .model-description h6 {
          font-weight: 600;
          margin: 1rem 0 0.5rem 0;
        }
        .model-description h1 { font-size: 1.25rem; }
        .model-description h2 { font-size: 1.125rem; }
        .model-description h3 { font-size: 1rem; }
      `}</style>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Model Manager</h2>
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('discover')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  activeTab === 'discover'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Discover
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  activeTab === 'library'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Library
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowApiKeys(!showApiKeys)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="API Settings"
            >
              <Key className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Keys Panel */}
        {showApiKeys && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">API Keys (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">CivitAI API Key</label>
                <input
                  type="password"
                  value={apiKeys.civitai || ''}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, civitai: e.target.value }))}
                  onBlur={() => saveApiKeys(apiKeys)}
                  placeholder="For higher rate limits and NSFW content"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Hugging Face Token</label>
                <input
                  type="password"
                  value={apiKeys.huggingface || ''}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, huggingface: e.target.value }))}
                  onBlur={() => saveApiKeys(apiKeys)}
                  placeholder="For private repositories"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'discover' ? (
            <div className="h-full flex flex-col">
              {/* Search Interface */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col space-y-4">
                  {/* Search Bar */}
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search for models..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={isSearching}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSearching ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>Search</span>
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center space-x-4 space-y-2">
                    {/* Source Selection */}
                    <div className="flex space-x-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Source:</label>
                      <select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value as 'civitai' | 'huggingface')}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1"
                      >
                        <option value="civitai">CivitAI</option>
                        <option value="huggingface">Hugging Face</option>
                      </select>
                    </div>

                    {/* Model Type Selection */}
                    <div className="flex flex-wrap items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Types:</label>
                      {modelTypes.map((type) => (
                        <label key={type.value} className="flex items-center space-x-1">
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
                            className="w-3 h-3 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Sort */}
                    {selectedSource === 'civitai' && (
                      <div className="flex space-x-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort:</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1"
                        >
                          <option value="Highest Rated">Highest Rated</option>
                          <option value="Most Downloaded">Most Downloaded</option>
                          <option value="Newest">Newest</option>
                        </select>
                      </div>
                    )}

                    {/* NSFW Toggle */}
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showNSFW}
                        onChange={(e) => setShowNSFW(e.target.checked)}
                        className="w-3 h-3 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Show NSFW</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-hidden flex">
                {/* Model List */}
                <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Searching...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-1 p-4">
                      {searchResults.map((model) => (
                        <div
                          key={`${model.source}-${model.id}`}
                          onClick={() => setSelectedModel(model)}
                          className={`p-4 rounded-lg cursor-pointer transition-colors ${
                            selectedModel?.id === model.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            {model.images[0] && (
                              <img
                                src={model.images[0]}
                                alt={model.name}
                                className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 dark:text-white truncate">{model.name}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">by {model.creator}</p>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                  {model.type}
                                </span>
                                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Download className="w-3 h-3" />
                                  <span>{model.stats.downloads.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Heart className="w-3 h-3" />
                                  <span>{model.stats.likes}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No models found. Try a different search term.' : 'Enter a search term to find models.'}
                    </div>
                  )}
                </div>

                {/* Model Details */}
                <div className="w-1/2 overflow-y-auto">
                  {selectedModel ? (
                    <div className="p-6">
                      <div className="space-y-6">
                        {/* Model Info */}
                        <div>
                          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedModel.name}</h2>
                          <p className="text-gray-600 dark:text-gray-400">by {selectedModel.creator}</p>
                                                      <div 
                              className="text-sm text-gray-600 dark:text-gray-400 mt-2 prose prose-sm dark:prose-invert max-w-none model-description"
                              dangerouslySetInnerHTML={{ __html: sanitizeHTML(selectedModel.description) }}
                            />
                        </div>

                        {/* Images */}
                        {selectedModel.images.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Preview Images</h3>
                            <div className="grid grid-cols-2 gap-3">
                              {selectedModel.images.map((image, index) => (
                                <img
                                  key={`${selectedModel.id}-image-${index}`}
                                  src={image}
                                  alt={`${selectedModel.name} preview ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Versions and Downloads */}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Available Versions</h3>
                          <div className="space-y-4">
                            {selectedModel.versions.map((version) => (
                              <div key={`${selectedModel.id}-${version.id}`} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white">{version.name}</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Base Model: {version.baseModel}</p>
                                  </div>
                                </div>
                                
                                {/* Files */}
                                <div className="space-y-2">
                                  {version.files.map((file, fileIndex) => {
                                    const downloadProgress = downloads.find(d => d.filename === file.name);
                                    const isDownloading = downloadProgress && !downloadProgress.completed;
                                    const isCompleted = downloadProgress && downloadProgress.completed;
                                    
                                    return (
                                      <div key={`${selectedModel.id}-${version.id}-${file.name}-${fileIndex}`} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                              {formatBytes(file.sizeKB * 1024)}
                                            </span>
                                            {file.metadata.fp && (
                                              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                                                {file.metadata.fp}
                                              </span>
                                            )}
                                          </div>
                                          {isDownloading && (
                                            <div className="mt-2">
                                              <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                                                <span>{Math.round(downloadProgress.progress)}%</span>
                                                {downloadProgress.speed && <span>{downloadProgress.speed}</span>}
                                                {downloadProgress.eta && <span>ETA: {downloadProgress.eta}</span>}
                                              </div>
                                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                                                <div 
                                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                  style={{ width: `${downloadProgress.progress}%` }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                          {downloadProgress?.error && (
                                            <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                              Error: {downloadProgress.error}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => handleDownload(selectedModel, version, file)}
                                          disabled={isDownloading}
                                          className={`ml-3 px-3 py-1 rounded-md text-sm flex items-center space-x-1 ${
                                            isCompleted
                                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                              : isDownloading
                                              ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                                          }`}
                                        >
                                          {isCompleted ? (
                                            <>
                                              <CheckCircle className="w-3 h-3" />
                                              <span>Downloaded</span>
                                            </>
                                          ) : isDownloading ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              <span>Downloading</span>
                                            </>
                                          ) : (
                                            <>
                                              <Download className="w-3 h-3" />
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
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                      Select a model to view details and download options
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Library Tab */
            <div className="h-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Local Models</h3>
                <button
                  onClick={loadLocalModels}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
              
              <div className="space-y-6">
                {Object.entries(localModels).map(([modelType, models]) => (
                  models.length > 0 && (
                    <div key={modelType}>
                      <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                        {getModelTypeDisplayName(modelType)} ({models.length})
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {models.map((model, index) => (
                          <div key={`${modelType}-${model.name}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 dark:text-white">{model.name}</h5>
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                                <span>{formatBytes(model.size)}</span>
                                <span>Modified: {new Date(model.modified).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteModel(modelType, model.name)}
                              className="px-3 py-1 text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                
                {Object.values(localModels).every(models => models.length === 0) && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No local models found</p>
                    <p className="text-sm">Download models from the Discover tab to see them here</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default ModelManager;