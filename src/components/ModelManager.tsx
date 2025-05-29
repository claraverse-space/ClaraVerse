import React, { useState, useEffect } from 'react';
import { Download, Search, Trash2, HardDrive, Cloud, TrendingUp, Star, FileText, X, ExternalLink, Cpu, Database } from 'lucide-react';

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
  pipeline_tag?: string;
  library_name?: string;
  modelId?: string;
  isVisionModel?: boolean;
  requiredMmprojFiles?: Array<{ rfilename: string; size?: number }>;
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
  onDownloadWithDependencies?: (modelId: string, fileName: string, allFiles: Array<{ rfilename: string; size?: number }>) => void;
  downloading: Set<string>;
  downloadProgress: { [fileName: string]: DownloadProgress };
  formatFileSize: (bytes: number) => string;
  onTagClick?: (tag: string) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({ model, onDownload, onDownloadWithDependencies, downloading, downloadProgress, formatFileSize, onTagClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModelCard, setShowModelCard] = useState(false);
  const [modelCardContent, setModelCardContent] = useState<string>('');
  const [loadingModelCard, setLoadingModelCard] = useState(false);
  
  // Calculate total model size
  const totalSize = model.files.reduce((acc, file) => acc + (file.size || 0), 0);
  
  // Check if this is a vision model
  const isVisionModel = model.isVisionModel || 
    model.tags.some(tag => ['vision', 'multimodal', 'vl'].includes(tag.toLowerCase())) || 
    model.name.toLowerCase().includes('vl') || 
    model.description.toLowerCase().includes('vision');
  
  // Find mmproj files
  const mmprojFiles = model.requiredMmprojFiles || 
    model.files.filter(file => 
      file.rfilename.toLowerCase().includes('mmproj') ||
      file.rfilename.toLowerCase().includes('mm-proj') ||
      file.rfilename.toLowerCase().includes('projection')
    );
  
  const hasRequiredMmproj = isVisionModel && mmprojFiles.length > 0;
  
  // Helper function to check if a file is mmproj
  const isMmprojFile = (filename: string) => {
    return filename.toLowerCase().includes('mmproj') ||
           filename.toLowerCase().includes('mm-proj') ||
           filename.toLowerCase().includes('projection');
  };
  
  // Get model parameters from name (heuristic)
  const getModelParams = (name: string): string => {
    const paramMatch = name.match(/(\d+\.?\d*)[bB]/i);
    if (paramMatch) {
      const params = parseFloat(paramMatch[1]);
      return params >= 1 ? `${params}B` : `${(params * 1000).toFixed(0)}M`;
    }
    return 'Unknown';
  };

  // Sort files to prioritize Q4 quantized models
  const sortFilesByPriority = (files: Array<{ rfilename: string; size?: number }>) => {
    return [...files].sort((a, b) => {
      const aName = a.rfilename.toLowerCase();
      const bName = b.rfilename.toLowerCase();
      
      // Prioritize Q4 quantized models
      const aIsQ4 = aName.includes('q4') || aName.includes('4bit');
      const bIsQ4 = bName.includes('q4') || bName.includes('4bit');
      
      if (aIsQ4 && !bIsQ4) return -1;
      if (!aIsQ4 && bIsQ4) return 1;
      
      // Then prioritize other quantized models (Q5, Q6, Q8)
      const aIsQuant = /q[0-9]|[0-9]bit/i.test(aName);
      const bIsQuant = /q[0-9]|[0-9]bit/i.test(bName);
      
      if (aIsQuant && !bIsQuant) return -1;
      if (!aIsQuant && bIsQuant) return 1;
      
      // Finally, sort by file size (smaller first for quants)
      if (a.size && b.size) {
        return a.size - b.size;
      }
      
      return 0;
    });
  };

  // Load model card content
  const loadModelCard = async () => {
    if (modelCardContent) {
      setShowModelCard(true);
      return;
    }
    
    setLoadingModelCard(true);
    try {
      // Try to fetch README from HuggingFace
      const response = await fetch(`https://huggingface.co/${model.id}/raw/main/README.md`);
      if (response.ok) {
        const content = await response.text();
        setModelCardContent(content);
        setShowModelCard(true);
      } else {
        setModelCardContent(`# ${model.name}\n\n${model.description}\n\n**Author:** ${model.author}\n\n**Downloads:** ${model.downloads.toLocaleString()}\n\n**Tags:** ${model.tags.join(', ')}`);
        setShowModelCard(true);
      }
    } catch (error) {
      console.error('Error loading model card:', error);
      setModelCardContent(`# ${model.name}\n\n${model.description}\n\n**Author:** ${model.author}\n\n**Downloads:** ${model.downloads.toLocaleString()}\n\n**Tags:** ${model.tags.join(', ')}`);
      setShowModelCard(true);
    } finally {
      setLoadingModelCard(false);
    }
  };
  
  // Sort files to prioritize main model files, filter out mmproj
  const sortedFiles = sortFilesByPriority(
    model.files.filter(file => file.rfilename.endsWith('.gguf') && !isMmprojFile(file.rfilename))
  );
  
  return (
    <>
      <div className="bg-white/40 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700/60 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-gray-900/20">
        <div className="flex items-start gap-3">
          {/* Model Icon */}
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0">
            {model.name.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="font-semibold text-gray-900 dark:text-white text-base truncate">{model.name}</h5>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={loadModelCard}
                      disabled={loadingModelCard}
                      className="p-1 text-gray-400 hover:text-sakura-500 dark:hover:text-sakura-400 transition-colors rounded hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
                      title="View model card"
                    >
                      {loadingModelCard ? (
                        <div className="w-3 h-3 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                    </button>
                    <a
                      href={`https://huggingface.co/${model.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors rounded hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
                      title="View on HuggingFace"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">by {model.author}</p>
                
                {/* Model Stats */}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {model.downloads > 1000 ? `${(model.downloads / 1000).toFixed(0)}k` : model.downloads.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {model.likes > 1000 ? `${(model.likes / 1000).toFixed(0)}k` : model.likes.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    {getModelParams(model.name)}
                  </span>
                  {totalSize > 0 && (
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {formatFileSize(totalSize)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Vision Model Indicator */}
            {isVisionModel && (
              <div className="mb-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                  <div className="w-4 h-4 text-blue-600 dark:text-blue-400">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Vision-Language Model
                  </span>
                  {hasRequiredMmproj ? (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                      ✓ mmproj available
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                      ⚠ mmproj needed
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{model.description}</p>
            
            {/* Tags */}
            {model.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {model.pipeline_tag && (
                  <span className="px-2 py-0.5 bg-sakura-100 dark:bg-sakura-900/30 text-sakura-700 dark:text-sakura-300 text-xs rounded-full font-medium">
                    {model.pipeline_tag}
                  </span>
                )}
                {model.tags.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onTagClick?.(tag)}
                    className="px-2 py-0.5 bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300 text-xs rounded-full hover:bg-purple-200 dark:hover:bg-purple-700/50 transition-colors cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
                {model.tags.length > 3 && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    +{model.tags.length - 3}
                  </span>
                )}
              </div>
            )}
            
            {/* Primary Download - Always Visible */}
            {sortedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="bg-gray-50/80 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200/50 dark:border-gray-600/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{sortedFiles[0].rfilename}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                            Primary
                          </span>
                          {(sortedFiles[0].rfilename.toLowerCase().includes('q4') || sortedFiles[0].rfilename.toLowerCase().includes('4bit')) && (
                            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                              Q4
                            </span>
                          )}
                        </div>
                      </div>
                      {sortedFiles[0].size && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(sortedFiles[0].size)}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {downloading.has(sortedFiles[0].rfilename) ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin"></div>
                          {downloadProgress[sortedFiles[0].rfilename] && (
                            <div className="text-xs text-sakura-600 dark:text-sakura-400">
                              {downloadProgress[sortedFiles[0].rfilename].progress}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (hasRequiredMmproj && onDownloadWithDependencies) {
                              // Use new download with dependencies for vision models
                              onDownloadWithDependencies(model.id, sortedFiles[0].rfilename, model.files);
                            } else {
                              // Use regular download for non-vision models
                              onDownload(model.id, sortedFiles[0].rfilename);
                            }
                          }}
                          className="px-3 py-1.5 bg-sakura-500 text-white text-sm rounded-lg hover:bg-sakura-600 transition-colors flex items-center gap-2 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          {hasRequiredMmproj ? 'Download with mmproj' : 'Download'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Show mmproj files if available */}
                {mmprojFiles.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
                      📷 Required projection files for image processing:
                    </div>
                    {mmprojFiles.map((file) => (
                      <div key={file.rfilename} className="text-xs font-mono text-blue-700 dark:text-blue-300 flex justify-between items-center">
                        <span>{file.rfilename}</span>
                        {file.size && <span className="text-blue-500 dark:text-blue-400">({formatFileSize(file.size)})</span>}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Show More Files Button */}
                {sortedFiles.length > 1 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full text-left px-3 py-2 text-sm text-sakura-600 dark:text-sakura-400 hover:text-sakura-700 dark:hover:text-sakura-300 transition-colors bg-gray-50/50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center justify-between">
                      <span>{isExpanded ? 'Show Less' : `Show ${sortedFiles.length - 1} More Files`}</span>
                      <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </div>
                    </div>
                  </button>
                )}
                
                {/* Collapsible additional files */}
                {isExpanded && sortedFiles.length > 1 && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {sortedFiles.slice(1).map((file) => (
                      <div key={file.rfilename} className="bg-gray-50/80 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200/50 dark:border-gray-600/50">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{file.rfilename}</span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {(file.rfilename.toLowerCase().includes('q4') || file.rfilename.toLowerCase().includes('4bit')) && (
                                  <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                                    Q4
                                  </span>
                                )}
                                {(/q[0-9]|[0-9]bit/i.test(file.rfilename) && !file.rfilename.toLowerCase().includes('q4')) && (
                                  <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded">
                                    Quant
                                  </span>
                                )}
                              </div>
                            </div>
                            {file.size && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(file.size)}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {downloading.has(file.rfilename) ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin"></div>
                                {downloadProgress[file.rfilename] && (
                                  <div className="text-xs text-sakura-600 dark:text-sakura-400">
                                    {downloadProgress[file.rfilename].progress}%
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => onDownload(model.id, file.rfilename)}
                                className="px-3 py-1.5 bg-sakura-500 text-white text-sm rounded-lg hover:bg-sakura-600 transition-colors flex items-center gap-2"
                              >
                                <Download className="w-4 h-4" />
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

      {/* Model Card Modal */}
      {showModelCard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-sakura-500" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {model.name} - Model Card
                </h3>
              </div>
              <button
                onClick={() => setShowModelCard(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                  {modelCardContent}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ModelManager: React.FC = () => {
  // Model manager state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HuggingFaceModel[]>([]);
  const [popularModels, setPopularModels] = useState<HuggingFaceModel[]>([]);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<{ [fileName: string]: DownloadProgress }>({});
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [modelManagerTab, setModelManagerTab] = useState<'discover' | 'library'>('discover');
  const [trendingFilter, setTrendingFilter] = useState<'all' | 'month' | 'week' | 'today'>('month');

  // Load popular models on mount and when filter changes
  useEffect(() => {
    const loadPopularModels = async () => {
      if (!window.modelManager?.searchHuggingFaceModels) return;
      
      setIsLoadingPopular(true);
      try {
        let allModels: HuggingFaceModel[] = [];
        
        if (trendingFilter === 'all') {
          // For "All Time", search for popular models using trending terms
          const popularQueries = [
            'llama-3', 'qwen2.5', 'phi-3', 'mistral-7b', 'gemma-2',
            'llama', 'qwen', 'phi', 'mistral', 'gemma', 'deepseek', 'yi'
          ];
          
          for (const query of popularQueries) {
            const result = await window.modelManager.searchHuggingFaceModels(query, 3);
            if (result.success) {
              allModels.push(...result.models);
            }
          }
          
          // Remove duplicates and sort by downloads
          const uniqueModels = allModels.filter((model, index, self) => 
            index === self.findIndex(m => m.id === model.id)
          );
          
          const sortedModels = uniqueModels
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, 12);
          
          setPopularModels(sortedModels);
        } else {
          // For time-based filters, we'll use a broader search and then filter by date
          // Since HF API doesn't support date filtering, we'll search for recent model terms
          // and prioritize models with recent-sounding names
          const recentQueries = [
            'llama-3.2', 'llama-3.1', 'qwen2.5', 'phi-3.5', 'mistral-7b', 'gemma-2',
            'deepseek-r1', 'deepseek-v3', 'yi-1.5', 'claude', 'gpt', '2024', '2025'
          ];
          
          for (const query of recentQueries) {
            const result = await window.modelManager.searchHuggingFaceModels(query, 2);
            if (result.success) {
              allModels.push(...result.models);
            }
          }
          
          // Remove duplicates
          const uniqueModels = allModels.filter((model, index, self) => 
            index === self.findIndex(m => m.id === model.id)
          );
          
          // Filter by recency indicators in model names/descriptions
          const now = new Date();
          const cutoffDays = trendingFilter === 'today' ? 1 : 
                           trendingFilter === 'week' ? 7 : 30; // month
          
          // Since we can't get exact dates, we'll use heuristics:
          // 1. Models with version numbers suggesting recency (3.1, 3.2, 2.5, etc.)
          // 2. Models with "2024", "2025" in name/description
          // 3. Models with "latest", "new", "updated" keywords
          const recentKeywords = [
            '3.2', '3.1', '2.5', '2024', '2025', 'latest', 'new', 'updated', 
            'r1', 'v3', 'pro', 'turbo', 'instruct', 'chat'
          ];
          
          const filteredModels = uniqueModels.filter(model => {
            const searchText = `${model.name} ${model.description}`.toLowerCase();
            return recentKeywords.some(keyword => searchText.includes(keyword));
          });
          
          // If no recent models found, fall back to top downloaded
          const modelsToShow = filteredModels.length > 0 ? filteredModels : uniqueModels;
          
          // Sort by downloads and limit based on filter
          const sortedModels = modelsToShow
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, trendingFilter === 'today' ? 6 : trendingFilter === 'week' ? 8 : 12);
          
          setPopularModels(sortedModels);
        }
      } catch (error) {
        console.error('Error loading popular models:', error);
      } finally {
        setIsLoadingPopular(false);
      }
    };

    loadPopularModels();
  }, [trendingFilter]);

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

  // Clear search results and go back to popular models
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
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

  const downloadModelWithDependencies = async (modelId: string, fileName: string, allFiles: Array<{ rfilename: string; size?: number }>) => {
    if (!window.modelManager?.downloadModelWithDependencies) return;
    
    // Set downloading state for the main file initially
    setDownloading(prev => new Set([...prev, fileName]));
    
    try {
      const result = await window.modelManager.downloadModelWithDependencies(modelId, fileName, allFiles);
      if (result.success) {
        console.log('Downloaded files:', result.downloadedFiles);
        // Refresh local models
        const localResult = await window.modelManager.getLocalModels();
        if (localResult.success) {
          setLocalModels(localResult.models);
        }
      } else {
        console.error('Download with dependencies failed:', result.error);
      }
    } catch (error) {
      console.error('Error downloading model with dependencies:', error);
    } finally {
      // Clean up downloading state for all files that might have been downloaded
      setDownloading(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        
        // Also remove any mmproj files that might have been downloaded
        const visionKeywords = ['vl', 'vision', 'multimodal', 'mm', 'clip', 'siglip'];
        const isVision = visionKeywords.some(keyword => fileName.toLowerCase().includes(keyword));
        
        if (isVision) {
          // Find and remove mmproj files from downloading state
          allFiles.forEach(file => {
            if (file.rfilename.toLowerCase().includes('mmproj') ||
                file.rfilename.toLowerCase().includes('mm-proj') ||
                file.rfilename.toLowerCase().includes('projection')) {
              newSet.delete(file.rfilename);
            }
          });
        }
        
        return newSet;
      });
      
      // Clean up progress for all downloaded files
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        
        // Also clean up mmproj file progress
        const visionKeywords = ['vl', 'vision', 'multimodal', 'mm', 'clip', 'siglip'];
        const isVision = visionKeywords.some(keyword => fileName.toLowerCase().includes(keyword));
        
        if (isVision) {
          allFiles.forEach(file => {
            if (file.rfilename.toLowerCase().includes('mmproj') ||
                file.rfilename.toLowerCase().includes('mm-proj') ||
                file.rfilename.toLowerCase().includes('projection')) {
              delete newProgress[file.rfilename];
            }
          });
        }
        
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
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchModels()}
                  placeholder="Search for models (e.g., 'llama', 'qwen', 'phi')"
                  className="flex-1 px-4 py-3 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                />
                <button
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
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{searchResults.length} models found</span>
                      <button
                        onClick={clearSearch}
                        className="px-3 py-1 text-sm text-sakura-600 dark:text-sakura-400 hover:text-sakura-700 dark:hover:text-sakura-300 transition-colors"
                      >
                        Back to Trending
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 max-h-[600px] overflow-y-auto">
                    {searchResults.map((model) => (
                      <ModelCard key={model.id} model={model} onDownload={downloadModel} onDownloadWithDependencies={downloadModelWithDependencies} downloading={downloading} downloadProgress={downloadProgress} formatFileSize={formatFileSize} onTagClick={handleTagFilter} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Popular Models Section - Show when no search results */}
            {searchResults.length === 0 && (
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-sakura-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Trending Models
                    </h3>
                    <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">
                      <Star className="w-3 h-3" />
                      Popular
                    </div>
                  </div>
                  
                  {/* Time Filter */}
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
                    {[
                      { key: 'today', label: 'Today' },
                      { key: 'week', label: 'Week' },
                      { key: 'month', label: 'Month' },
                      { key: 'all', label: 'All' }
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        onClick={() => setTrendingFilter(filter.key as typeof trendingFilter)}
                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                          trendingFilter === filter.key
                            ? 'bg-sakura-500 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {isLoadingPopular ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading trending models...</p>
                  </div>
                ) : popularModels.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {trendingFilter === 'today' ? 'Latest and most recent models' :
                         trendingFilter === 'week' ? 'Recently updated trending models' :
                         trendingFilter === 'month' ? 'Recent popular models' :
                         'All-time most downloaded models'}
                      </p>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{popularModels.length} models</span>
                    </div>
                    <div className="grid gap-4 max-h-[600px] overflow-y-auto">
                      {popularModels.map((model) => (
                        <ModelCard key={model.id} model={model} onDownload={downloadModel} onDownloadWithDependencies={downloadModelWithDependencies} downloading={downloading} downloadProgress={downloadProgress} formatFileSize={formatFileSize} onTagClick={handleTagFilter} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No trending models found</h4>
                    <p className="text-gray-500 dark:text-gray-400">
                      Try a different time period or search for specific models above
                    </p>
                  </div>
                )}
              </div>
            )}
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
  );
};

export default ModelManager; 