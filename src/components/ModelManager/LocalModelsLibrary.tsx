import React, { useEffect, useState } from 'react';
import { HardDrive, Cloud, Trash2, Eye, Link, AlertTriangle, FileIcon } from 'lucide-react';
import { useProviders } from '../../contexts/ProvidersContext';
import { LocalModel, VisionCompatibilityInfo } from './types';
import { formatFileSize } from './utils';

interface LocalModelsLibraryProps {
  localModels: LocalModel[];
  onDeleteModel: (filePath: string) => void;
  deleting: Set<string>;
  onModelManagerTabChange: (tab: 'discover' | 'library') => void;
  onManageMmproj: (model: LocalModel) => void;
}

const LocalModelsLibrary: React.FC<LocalModelsLibraryProps> = ({
  localModels,
  onDeleteModel,
  deleting,
  onModelManagerTabChange,
  onManageMmproj
}) => {
  const { customModelPath } = useProviders();
  const [modelEmbeddingInfo, setModelEmbeddingInfo] = useState<Map<string, VisionCompatibilityInfo>>(new Map());

  // Helper function to check if a file is an mmproj model
  const isMmprojModel = (filename: string) => {
    return filename.toLowerCase().includes('mmproj') || 
           filename.toLowerCase().includes('mm-proj') ||
           filename.toLowerCase().includes('projection');
  };

  // Helper function to check if a file is an embedding model
  const isEmbeddingModel = (filename: string) => {
    const embeddingKeywords = [
      'embed', 'embedding', 'embeddings',
      'mxbai', 'nomic', 'bge', 'e5',
      'sentence-transformer', 'sentence_transformer',
      'all-minilm', 'all_minilm'
    ];
    const lowerFilename = filename.toLowerCase();
    return embeddingKeywords.some(keyword => lowerFilename.includes(keyword));
  };

  // Function to load embedding info for a model
  const loadModelEmbeddingInfo = async (model: LocalModel) => {
    if (modelEmbeddingInfo.has(model.path)) return;
    
    try {
      const result = await window.llamaSwap.getModelEmbeddingInfo(model.path);
      if (result.success) {
        const compatibilityInfo: VisionCompatibilityInfo = {
          embeddingSize: result.embeddingSize || 'unknown',
          isVisionModel: result.isVisionModel || false,
          needsMmproj: result.needsMmproj || false,
          compatibleMmprojFiles: result.compatibleMmprojFiles || [],
          hasCompatibleMmproj: result.hasCompatibleMmproj || false,
          compatibilityStatus: result.compatibilityStatus || 'unknown'
        };

        // If it's a vision model that needs mmproj and doesn't have compatible local ones,
        // search Hugging Face for compatible mmproj files
        if (compatibilityInfo.isVisionModel && !compatibilityInfo.hasCompatibleMmproj && 
            typeof compatibilityInfo.embeddingSize === 'number') {
          try {
            const hfResult = await window.llamaSwap.searchHuggingFaceMmproj(
              model.file || model.name, 
              compatibilityInfo.embeddingSize
            );
            if (hfResult.success && hfResult.results) {
              compatibilityInfo.availableHuggingFaceMmproj = hfResult.results;
            }
          } catch (error) {
            console.warn('Error searching Hugging Face for mmproj files:', error);
          }
        }

        setModelEmbeddingInfo(prev => new Map(prev).set(model.path, compatibilityInfo));
      }
    } catch (error) {
      console.error('Error loading model embedding info:', error);
    }
  };

  // Load embedding info when models are loaded
  useEffect(() => {
    if (localModels.length > 0) {
      localModels.forEach(model => {
        loadModelEmbeddingInfo(model);
      });
    }
  }, [localModels]);

  // Handle opening mmproj selector for a specific model
  const handleManageMmproj = (model: LocalModel) => {
    onManageMmproj(model);
  };

  return (
    <div className="glassmorphic rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Your Model Library
          </h3>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {customModelPath && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span>Custom: {localModels.filter(m => m.source === 'custom').length}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>Models: {localModels.filter(m => m.source === 'user').length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            <span>Embedding: {localModels.filter(m => isEmbeddingModel(m.file)).length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
            <span>mmproj: {localModels.filter(m => isMmprojModel(m.file)).length}</span>
          </div>
          <span>Total Storage: {localModels.reduce((acc, model) => acc + model.size, 0) > 0 ? formatFileSize(localModels.reduce((acc, model) => acc + model.size, 0)) : '0 B'}</span>
        </div>
      </div>

      
      {localModels.length > 0 ? (
        <div className="grid gap-3">
          {localModels.map((model) => (
            <div key={model.path} className="flex items-center gap-4 p-4 bg-white/30 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${
                model.source === 'custom' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                model.source === 'user' ? 'bg-gradient-to-br from-green-400 to-green-600' :
                'bg-gradient-to-br from-purple-400 to-purple-600'
              }`}>
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="font-semibold text-gray-900 dark:text-white">{model.name}</h5>

                </div>
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
                  {model.source === 'custom' && customModelPath && (
                    <span className="text-blue-600 dark:text-blue-400" title={model.path}>
                      📁 {customModelPath}
                    </span>
                  )}
                  
                  {/* Model Type Tags */}
                  {isMmprojModel(model.file) && (
                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <FileIcon className="w-3 h-3" />
                      mmproj
                    </span>
                  )}
                  {isEmbeddingModel(model.file) && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      embedding
                    </span>
                  )}
                  {model.isVisionModel && !isMmprojModel(model.file) && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Eye className="w-3 h-3" />
                      Vision
                    </span>
                  )}
                  {model.hasAssignedMmproj && !isMmprojModel(model.file) && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Link className="w-3 h-3" />
                      linked mmproj
                    </span>
                  )}
                  {model.isVisionModel && !model.hasAssignedMmproj && !isMmprojModel(model.file) && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      needs mmproj
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                
                {/* mmproj Management Button - Only show for non-mmproj and non-embedding files */}
                {!isMmprojModel(model.file) && !isEmbeddingModel(model.file) && (
                  <button
                    onClick={() => handleManageMmproj(model)}
                    className="p-2 rounded-lg transition-colors text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    title="Manage mmproj assignment"
                  >
                    <Link className="w-4 h-4" />
                  </button>
                )}

                {deleting.has(model.path) ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white text-xs rounded-lg opacity-50 cursor-not-allowed">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Removing...
                  </div>
                ) : (
                  <button
                    onClick={() => onDeleteModel(model.path)}
                    disabled={deleting.has(model.path) || model.source === 'bundled'}
                    className={`p-2 rounded-lg transition-colors ${
                      model.source === 'bundled' 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                    title={model.source === 'bundled' ? 'Cannot delete bundled models' : 'Remove model'}
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
            Download models from the Discover tab or set a custom model directory to get started
          </p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => onModelManagerTabChange('discover')}
              className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors"
            >
              Discover Models
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default LocalModelsLibrary; 