import React, { useState } from 'react';
import { Download, AlertTriangle, CheckCircle, Info, Cpu, HardDrive, Zap, Eye, Tag, Calendar, User, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { HuggingFaceModel, DownloadProgress } from './types';

interface EnhancedModel extends HuggingFaceModel {
  compatibility: {
    fitsInRAM: 'yes' | 'maybe' | 'no';
    fitsInVRAM: 'yes' | 'maybe' | 'no' | 'na';
    parameterCount: string;
    estimatedRAMUsage: number;
    quantization: string;
    architecture: string;
    fitAnalysis?: {
      fitsFullyInGPU: boolean;
      fitsInRAMPlusGPU: boolean;
      recommendedMemoryGB: number;
      modelSizeGB: number;
    } | null;
  };
  metadata?: {
    embeddingSize?: number;
    contextLength?: number;
    isVisionModel?: boolean;
    needsMmproj?: boolean;
    hasMmproj?: boolean;
    mmprojFiles?: Array<{ rfilename: string; size?: number }>;
    availableQuantizations?: Array<{
      type: string;
      files: Array<{ rfilename: string; size?: number }>;
      totalSize: number;
      displayName: string;
    }>;
  };
}

interface SystemInfo {
  totalRAM: number;
  availableRAM: number;
  gpu: {
    name: string;
    vram: number;
    hasNvidiaGPU: boolean;
    isAMD: boolean;
  } | null;
}

interface EnhancedModelCardProps {
  model: EnhancedModel;
  onDownload: (modelId: string, fileName: string) => void;
  onDownloadWithDependencies?: (modelId: string, fileName: string, allFiles: Array<{ rfilename: string; size?: number }>) => void;
  onAddToQueue?: (modelId: string, fileName: string, allFiles?: Array<{ rfilename: string; size?: number }>) => void;
  downloading: Set<string>;
  downloadProgress: { [fileName: string]: DownloadProgress };
  systemInfo: SystemInfo | null;
}

const EnhancedModelCard: React.FC<EnhancedModelCardProps> = ({
  model,
  onDownload,
  onDownloadWithDependencies,
  onAddToQueue,
  downloading,
  downloadProgress,
  systemInfo
}) => {
  const [showQuantizationSelector, setShowQuantizationSelector] = useState(false);
  const [selectedQuantization, setSelectedQuantization] = useState<{
    type: string;
    files: Array<{ rfilename: string; size?: number }>;
    totalSize: number;
    displayName: string;
  } | null>(null);

  // Helper function to handle downloads with error handling
  const handleDownloadWithQueue = async (
    downloadFn: () => Promise<void> | void,
    modelId: string,
    fileName: string,
    allFiles?: Array<{ rfilename: string; size?: number }>
  ) => {
    try {
      await downloadFn();
    } catch (error) {
      console.error('Download failed:', error);
      
      // Check if it's a rate limit error (HTTP 429)
      if (error instanceof Error && (error.message.includes('429') || error.message.toLowerCase().includes('rate limit'))) {
        // Add to queue if rate limited
        if (onAddToQueue) {
          onAddToQueue(modelId, fileName, allFiles);
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getCompatibilityColor = (status: string) => {
    switch (status) {
      case 'yes': return 'text-green-600 dark:text-green-400';
      case 'maybe': return 'text-yellow-600 dark:text-yellow-400';
      case 'no': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getCompatibilityIcon = (status: string) => {
    switch (status) {
      case 'yes': return <CheckCircle className="w-4 h-4" />;
      case 'maybe': return <AlertTriangle className="w-4 h-4" />;
      case 'no': return <AlertTriangle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  // Filter to show only GGUF model files, prioritize the best quantization
  const ggufFiles = model.files.filter(file => {
    const filename = file.rfilename.toLowerCase();
    return filename.includes('.gguf') && !filename.includes('readme') && !filename.includes('.md');
  });
  
  // Use GGUF files if available, otherwise fall back to all files
  const modelFiles = ggufFiles.length > 0 ? ggufFiles : model.files;
  const primaryFile = modelFiles[0];
  const isDownloading = downloading.has(primaryFile?.rfilename || '');
  const progress = downloadProgress[primaryFile?.rfilename || ''];

  // Calculate size from GGUF files only
  const modelSize = modelFiles.reduce((acc, file) => acc + (file.size || 0), 0);

  return (
    <div className="glassmorphic rounded-xl p-6 hover:shadow-lg transition-all duration-300 border border-gray-200/20">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">
              {model.name}
            </h3>
            <div className="flex items-center gap-2">
              {model.metadata?.isVisionModel && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                  <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Vision</span>
                </div>
              )}
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                <Tag className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {model.compatibility.architecture}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{model.author || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowDown className="w-4 h-4" />
              <span>{formatNumber(model.downloads)} downloads</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{model.lastModified ? new Date(model.lastModified).toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>

          {model.description && (
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-4">
              {model.description}
            </p>
          )}
        </div>
      </div>

      {/* Model Specifications */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Parameters</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {model.compatibility.parameterCount}
          </span>
        </div>

        <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Size</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatBytes(modelSize)}
          </span>
        </div>

        <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Quantization</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {model.compatibility.quantization}
          </span>
        </div>

        <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Est. RAM</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatBytes(model.compatibility.estimatedRAMUsage)}
          </span>
        </div>
      </div>

      {/* Compatibility Status */}
      {systemInfo && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">System Compatibility</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">RAM Fit</span>
              </div>
              <div className={`flex items-center gap-1 ${getCompatibilityColor(model.compatibility.fitsInRAM)}`}>
                {getCompatibilityIcon(model.compatibility.fitsInRAM)}
                <span className="text-sm font-medium capitalize">
                  {model.compatibility.fitsInRAM}
                </span>
              </div>
            </div>

            {systemInfo.gpu && systemInfo.gpu.vram > 0 && model.compatibility.fitsInVRAM !== 'na' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">GPU Fit</span>
                </div>
                <div className={`flex items-center gap-1 ${getCompatibilityColor(model.compatibility.fitsInVRAM)}`}>
                  {getCompatibilityIcon(model.compatibility.fitsInVRAM)}
                  <span className="text-sm font-medium">
                    {model.compatibility.fitAnalysis?.fitsFullyInGPU ? 'Fully' : 
                     model.compatibility.fitAnalysis?.fitsInRAMPlusGPU ? 'Hybrid' : 
                     model.compatibility.fitsInVRAM}
                  </span>
                </div>
              </div>
            )}

            {(!systemInfo.gpu || systemInfo.gpu.vram === 0) && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">GPU Fit</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Info className="w-4 h-4" />
                  <span className="text-sm font-medium">N/A</span>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Memory Analysis */}
          {model.compatibility.fitAnalysis && systemInfo && (
            <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Memory Analysis</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Model Size:</span>
                  <span className="ml-1 font-medium text-gray-900 dark:text-white">
                    {model.compatibility.fitAnalysis.modelSizeGB}GB
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Est. RAM:</span>
                  <span className="ml-1 font-medium text-gray-900 dark:text-white">
                    {model.compatibility.fitAnalysis.recommendedMemoryGB}GB
                  </span>
                </div>
              </div>
              
              {model.compatibility.fitAnalysis.fitsFullyInGPU && (
                <div className="mt-2 text-xs text-green-700 dark:text-green-400">
                  ✅ Fits fully in GPU VRAM - Best performance expected
                </div>
              )}
              
              {!model.compatibility.fitAnalysis.fitsFullyInGPU && model.compatibility.fitAnalysis.fitsInRAMPlusGPU && (
                <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
                  🔄 Fits with RAM+GPU hybrid - Good performance with some RAM offloading
                </div>
              )}
              
              {!model.compatibility.fitAnalysis.fitsInRAMPlusGPU && (
                <div className="mt-2 text-xs text-red-700 dark:text-red-400">
                  ❌ Model too large for available memory - Consider smaller quantization
                </div>
              )}
            </div>
          )}

          {model.compatibility.fitsInRAM === 'no' && !model.compatibility.fitAnalysis?.fitsInRAMPlusGPU && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-4 border-red-500">
              <p className="text-xs text-red-700 dark:text-red-400">
                ⚠️ This model requires more memory than available. Try a smaller quantization like Q4_K_S.
              </p>
            </div>
          )}

          {model.metadata?.needsMmproj && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-500">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                {model.metadata?.hasMmproj ? (
                  <>🖼️ This vision model supports images and includes required mmproj files. Download will automatically include vision components.</>
                ) : (
                  <>⚠️ This vision model requires mmproj files for image support, but they're not available in this repository. Image features may not work properly.</>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Download Section */}
      <div className="space-y-3">
        {/* Primary File Info */}
        {primaryFile && (
          <div className="bg-white/30 dark:bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Primary Download
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatBytes(primaryFile.size || 0)}
              </span>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
              {primaryFile.rfilename}
            </div>
          </div>
        )}

        {/* Quantization Selector */}
        {model.metadata?.availableQuantizations && model.metadata.availableQuantizations.length > 1 && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Available Quantizations ({model.metadata.availableQuantizations.length})
              </span>
            </div>
            <div className="space-y-1">
              {model.metadata.availableQuantizations.slice(0, 3).map((quant, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-green-600 dark:text-green-400 font-mono">
                    {quant.displayName}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatBytes(quant.totalSize)}
                  </span>
                </div>
              ))}
              {model.metadata.availableQuantizations.length > 3 && (
                <div className="text-xs text-green-500 dark:text-green-400">
                  +{model.metadata.availableQuantizations.length - 3} more quantizations...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional Files Info */}
        {modelFiles.length > 1 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Additional GGUF Files Available ({modelFiles.length - 1})
              </span>
            </div>
            <div className="space-y-1">
              {modelFiles.slice(1, 3).map((file, index) => (
                <div key={index} className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                  {file.rfilename} ({formatBytes(file.size || 0)})
                </div>
              ))}
              {modelFiles.length > 3 && (
                <div className="text-xs text-blue-500 dark:text-blue-400">
                  +{modelFiles.length - 3} more GGUF files...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Download Buttons */}
        <div className="space-y-3">
          {/* Quantization Selector Button */}
          {model.metadata?.availableQuantizations && model.metadata.availableQuantizations.length > 1 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowQuantizationSelector(!showQuantizationSelector)}
                className="w-full px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors text-sm flex items-center justify-between gap-2 border border-green-200 dark:border-green-700"
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  <span>Choose Quantization ({model.metadata.availableQuantizations.length} options)</span>
                </div>
                {showQuantizationSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {/* Quantization Options Dropdown */}
              {showQuantizationSelector && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Select Quantization Type</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Choose the best quantization for your system</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {model.metadata.availableQuantizations
                      .sort((a, b) => a.totalSize - b.totalSize) // Sort by size, smallest first
                      .map((quant, index) => {
                        const fitsInRAM = systemInfo ? quant.totalSize <= systemInfo.availableRAM * 0.8 : true;
                        const fitsInGPU = systemInfo?.gpu ? quant.totalSize <= systemInfo.gpu.vram * 0.8 : false;
                        const fitsInHybrid = systemInfo?.gpu && systemInfo.availableRAM ? 
                          quant.totalSize <= (systemInfo.gpu.vram + systemInfo.availableRAM * 0.6) : false;
                        
                        let compatibilityStatus = 'unknown';
                        let compatibilityText = '';
                        let compatibilityColor = 'text-gray-600 dark:text-gray-400';
                        
                        if (fitsInGPU) {
                          compatibilityStatus = 'gpu';
                          compatibilityText = 'Fits in GPU (Best Performance)';
                          compatibilityColor = 'text-green-600 dark:text-green-400';
                        } else if (fitsInHybrid) {
                          compatibilityStatus = 'hybrid';
                          compatibilityText = 'Fits with RAM+GPU (Good Performance)';
                          compatibilityColor = 'text-yellow-600 dark:text-yellow-400';
                        } else if (fitsInRAM) {
                          compatibilityStatus = 'ram';
                          compatibilityText = 'Fits in RAM (CPU Only)';
                          compatibilityColor = 'text-blue-600 dark:text-blue-400';
                        } else {
                          compatibilityStatus = 'none';
                          compatibilityText = 'Too large for available memory';
                          compatibilityColor = 'text-red-600 dark:text-red-400';
                        }
                        
                        return (
                          <div
                            key={index}
                            className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
                              selectedQuantization?.type === quant.type ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                            onClick={() => {
                              setSelectedQuantization(quant);
                              setShowQuantizationSelector(false);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                    {quant.displayName}
                                  </span>
                                  {compatibilityStatus === 'gpu' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                  {compatibilityStatus === 'hybrid' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                                  {compatibilityStatus === 'ram' && <Info className="w-4 h-4 text-blue-500" />}
                                  {compatibilityStatus === 'none' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  <span>{formatBytes(quant.totalSize)}</span>
                                  <span>{quant.files.length} file{quant.files.length > 1 ? 's' : ''}</span>
                                </div>
                                <div className={`text-xs ${compatibilityColor}`}>
                                  {compatibilityText}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {index === 0 && <span className="text-green-600 dark:text-green-400 font-medium">Recommended</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Selected Quantization Info */}
          {selectedQuantization && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Selected: {selectedQuantization.displayName}
                </span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <div>Size: {formatBytes(selectedQuantization.totalSize)}</div>
                <div>Files: {selectedQuantization.files.length}</div>
                <div className="font-mono text-gray-600 dark:text-gray-400">
                  {selectedQuantization.files.slice(0, 2).map(f => f.rfilename).join(', ')}
                  {selectedQuantization.files.length > 2 && ` +${selectedQuantization.files.length - 2} more`}
                </div>
              </div>
            </div>
          )}
          
          {/* Download Actions */}
          <div className="flex items-center gap-2">
            {/* Download Selected Quantization */}
            {selectedQuantization && (
              <button
                onClick={() => handleDownloadWithQueue(
                  () => {
                    if (onDownloadWithDependencies) {
                      // Include mmproj files if this is a vision model
                      const filesToDownload = [...selectedQuantization.files];
                      if (model.metadata?.needsMmproj && model.metadata?.mmprojFiles?.length) {
                        filesToDownload.push(...model.metadata.mmprojFiles);
                        console.log('Including mmproj files for vision model:', model.metadata.mmprojFiles.map(f => f.rfilename));
                      }
                      onDownloadWithDependencies(model.id, selectedQuantization.files[0]?.rfilename || '', filesToDownload);
                    }
                    setSelectedQuantization(null);
                  },
                  model.id,
                  selectedQuantization.files[0]?.rfilename || '',
                  (() => {
                    const filesToDownload = [...selectedQuantization.files];
                    if (model.metadata?.needsMmproj && model.metadata?.mmprojFiles?.length) {
                      filesToDownload.push(...model.metadata.mmprojFiles);
                    }
                    return filesToDownload;
                  })()
                )}
                disabled={isDownloading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download {selectedQuantization.displayName} ({formatBytes(selectedQuantization.totalSize)})
                {model.metadata?.needsMmproj && model.metadata?.mmprojFiles?.length && (
                  <span className="text-xs opacity-75">+ Vision Files</span>
                )}
              </button>
            )}
            
            {/* Download All Files (when multiple files but no quantization options) */}
            {(!model.metadata?.availableQuantizations || model.metadata.availableQuantizations.length <= 1) && modelFiles.length > 1 && onDownloadWithDependencies && !selectedQuantization && (
              <button
                onClick={() => handleDownloadWithQueue(
                  () => {
                    // Include mmproj files if this is a vision model
                    const filesToDownload = [...modelFiles];
                    if (model.metadata?.needsMmproj && model.metadata?.mmprojFiles?.length) {
                      filesToDownload.push(...model.metadata.mmprojFiles);
                      console.log('Including mmproj files for vision model:', model.metadata.mmprojFiles.map((f: any) => f.rfilename));
                    }
                    onDownloadWithDependencies(model.id, primaryFile?.rfilename || '', filesToDownload);
                  },
                  model.id,
                  primaryFile?.rfilename || '',
                  (() => {
                    const filesToDownload = [...modelFiles];
                    if (model.metadata?.needsMmproj && model.metadata?.mmprojFiles?.length) {
                      filesToDownload.push(...model.metadata.mmprojFiles);
                    }
                    return filesToDownload;
                  })()
                )}
                disabled={isDownloading}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download All ({modelFiles.length} files)
                {model.metadata?.needsMmproj && model.metadata?.mmprojFiles?.length && (
                  <span className="text-xs opacity-75">+ Vision Files</span>
                )}
              </button>
            )}
            
            {/* Download Primary File */}
            {!selectedQuantization && (
              <button
                onClick={() => handleDownloadWithQueue(
                  () => onDownload(model.id, primaryFile?.rfilename || ''),
                  model.id,
                  primaryFile?.rfilename || ''
                )}
                disabled={isDownloading || !primaryFile}
                className="flex-1 px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isDownloading ? 'Downloading...' : `Download ${model.compatibility.quantization} (${primaryFile ? formatBytes(primaryFile.size || 0) : '0 B'})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Download Progress */}
      {isDownloading && progress && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">
              {formatBytes(progress.downloadedSize)} / {formatBytes(progress.totalSize)}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {(progress.progress * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-sakura-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedModelCard;
