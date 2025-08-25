import React, { memo, useState, useEffect, useCallback } from 'react';
import { Image, Settings, Play, AlertCircle, RefreshCw, Download, Sliders } from 'lucide-react';
import { NodeProps } from 'reactflow';
import BaseNode from './BaseNode';
import { comfyUIImageGenService } from '../../../services/comfyUIImageGenService';
import { useAgentBuilder } from '../../../contexts/AgentBuilder/AgentBuilderContext';

// ComfyUI Image Generation Node Data Interface
export interface ComfyUIImageGenNodeData {
  // Input
  prompt: string;
  
  // Model Configuration
  selectedModel: string;
  
  // Generation Parameters
  steps: number;
  guidanceScale: number;
  denoise: number;
  sampler: string;
  scheduler: string;
  
  // Image Dimensions
  width: number;
  height: number;
  selectedResolution: string;
  
  // Advanced Settings
  negativePrompt: string;
  seed: number;
  
  // Output Results
  lastGeneratedImage: string | null;
  lastGenerationResult: any;
  generationLogs: string[];
  
  // State
  isGenerating: boolean;
  generationProgress: number;
  generationError: string | null;
}

// Resolution presets
const RESOLUTION_PRESETS = [
  { label: 'Square (1:1)', width: 512, height: 512, value: 'square' },
  { label: 'Portrait (2:3)', width: 512, height: 768, value: 'portrait' },
  { label: 'Landscape (3:2)', width: 768, height: 512, value: 'landscape' },
  { label: 'HD (16:9)', width: 896, height: 504, value: 'hd' },
  { label: 'Mobile', width: 512, height: 896, value: 'mobile' },
  { label: 'Custom', width: 512, height: 512, value: 'custom' }
];

// Sampler options
const SAMPLERS = [
  'euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral',
  'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_sde',
  'dpmpp_2m', 'dpmpp_2m_sde', 'ddim', 'uni_pc'
];

// Scheduler options
const SCHEDULERS = [
  'normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'
];

export const ComfyUIImageGenNode: React.FC<NodeProps<ComfyUIImageGenNodeData>> = memo((props) => {
  const {
    id,
    data,
    selected,
    ...restProps
  } = props;
  
  // Hook to access node management functions
  const { updateNode } = useAgentBuilder();
  
  // Update data callback
  const updateData = useCallback((updates: Partial<ComfyUIImageGenNodeData>) => {
    updateNode(id, { data: { ...data, ...updates } });
  }, [id, data, updateNode]);
  // State for ComfyUI connection and models
  const [isComfyUIConnected, setIsComfyUIConnected] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // UI State
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showGenerationSettings, setShowGenerationSettings] = useState(true);
  
  // Default values
  const prompt = data.prompt || '';
  const selectedModel = data.selectedModel || '';
  const steps = data.steps || 20;
  const guidanceScale = data.guidanceScale || 7.5;
  const denoise = data.denoise || 1.0;
  const sampler = data.sampler || 'euler';
  const scheduler = data.scheduler || 'normal';
  const width = data.width || 512;
  const height = data.height || 512;
  const selectedResolution = data.selectedResolution || 'square';
  const negativePrompt = data.negativePrompt || '';
  const seed = data.seed || -1;
  const isGenerating = data.isGenerating || false;
  const generationProgress = data.generationProgress || 0;
  const generationError = data.generationError || null;
  const lastGeneratedImage = data.lastGeneratedImage || null;

  // Load ComfyUI models on component mount
  useEffect(() => {
    const loadComfyUIData = async () => {
      setIsLoadingModels(true);
      setConnectionError(null);
      
      try {
        console.log('🔌 Connecting to ComfyUI and loading models...');
        
        // Check ComfyUI connection and load models
        const connectionResult = await comfyUIImageGenService.connectToComfyUI();
        
        if (connectionResult.success) {
          setIsComfyUIConnected(true);
          const models = await comfyUIImageGenService.getAvailableModels();
          setAvailableModels(models);
          
          // Auto-select first model if none selected
          if (!selectedModel && models.length > 0) {
            handleModelSelection(models[0]);
          }
          
          console.log('✅ ComfyUI connected, models loaded:', models.length);
        } else {
          setConnectionError(connectionResult.error || 'Failed to connect to ComfyUI');
          console.error('❌ ComfyUI connection failed:', connectionResult.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setConnectionError(errorMessage);
        console.error('❌ Error loading ComfyUI data:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadComfyUIData();
  }, []);

  // Handle model selection with optimal configuration
  const handleModelSelection = useCallback((model: string) => {
    console.log('🎨 Selected model:', model);
    
    // Get optimal configuration for the selected model
    const optimalConfig = comfyUIImageGenService.getOptimalConfig(model);
    
    updateData({
      selectedModel: model,
      steps: optimalConfig.steps,
      guidanceScale: optimalConfig.guidanceScale,
      denoise: optimalConfig.denoise,
      sampler: optimalConfig.sampler,
      scheduler: optimalConfig.scheduler,
      negativePrompt: optimalConfig.negativePrompt || ''
    });
  }, [updateData]);

  // Handle resolution preset selection
  const handleResolutionChange = useCallback((resolutionValue: string) => {
    const preset = RESOLUTION_PRESETS.find(r => r.value === resolutionValue);
    if (preset) {
      updateData({
        selectedResolution: resolutionValue,
        width: preset.width,
        height: preset.height
      });
    }
  }, [updateData]);

  // Handle image generation
  const handleGenerateImage = useCallback(async () => {
    if (!prompt.trim()) {
      updateData({ generationError: 'Please enter a prompt' });
      return;
    }
    
    if (!selectedModel) {
      updateData({ generationError: 'Please select a model' });
      return;
    }

    console.log('🎨 Starting image generation...');
    
    updateData({
      isGenerating: true,
      generationError: null,
      generationProgress: 0,
      generationLogs: ['🚀 Starting image generation...']
    });

    try {
      const generationConfig = {
        prompt,
        model: selectedModel,
        steps,
        guidanceScale,
        denoise,
        sampler,
        scheduler,
        width,
        height,
        negativePrompt,
        seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed
      };

      // Progress callback
      const onProgress = (progress: number, message: string) => {
        updateData({
          generationProgress: progress,
          generationLogs: data.generationLogs ? [...data.generationLogs, message] : [message]
        });
      };

      const result = await comfyUIImageGenService.generateImage(generationConfig, onProgress);
      
      console.log('✅ Image generation completed');
      
      updateData({
        isGenerating: false,
        lastGeneratedImage: result.imageBase64,
        lastGenerationResult: result,
        generationProgress: 100,
        generationLogs: [...(data.generationLogs || []), '✅ Image generation completed!']
      });

    } catch (error) {
      console.error('❌ Image generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      
      updateData({
        isGenerating: false,
        generationError: errorMessage,
        generationLogs: [...(data.generationLogs || []), `❌ Error: ${errorMessage}`]
      });
    }
  }, [prompt, selectedModel, steps, guidanceScale, denoise, sampler, scheduler, width, height, negativePrompt, seed, data.generationLogs, updateData]);

  // Handle retry connection
  const handleRetryConnection = useCallback(async () => {
    setConnectionError(null);
    setIsLoadingModels(true);
    
    try {
      const connectionResult = await comfyUIImageGenService.connectToComfyUI();
      if (connectionResult.success) {
        setIsComfyUIConnected(true);
        const models = await comfyUIImageGenService.getAvailableModels();
        setAvailableModels(models);
      } else {
        setConnectionError(connectionResult.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Download generated image
  const handleDownloadImage = useCallback(() => {
    if (lastGeneratedImage) {
      const link = document.createElement('a');
      link.href = lastGeneratedImage;
      link.download = `generated-image-${Date.now()}.png`;
      link.click();
    }
  }, [lastGeneratedImage]);

  return (
    <BaseNode
      {...restProps}
      id={id}
      data={data}
      selected={selected}
      title="ComfyUI Image Generator"
      category="ai"
      icon={<Image className="w-5 h-5" />}
      inputs={[
        { id: 'prompt', name: 'Prompt', type: 'input', dataType: 'string' }
      ]}
      outputs={[
        { id: 'image', name: 'Generated Image', type: 'output', dataType: 'string' },
        { id: 'metadata', name: 'Generation Metadata', type: 'output', dataType: 'object' }
      ]}
      executing={isGenerating}
      success={!!(lastGeneratedImage && !generationError)}
      error={generationError || undefined}
    >
      <div className="space-y-4">
        {/* Connection Status */}
        {connectionError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{connectionError}</span>
            </div>
            <button
              onClick={handleRetryConnection}
              className="mt-2 px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded text-xs hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Prompt Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🎨 Image Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => updateData({ prompt: e.target.value })}
            placeholder="Describe the image you want to generate..."
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
            rows={3}
          />
        </div>

        {/* Model Selection */}
        {isComfyUIConnected && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🧠 Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelSelection(e.target.value)}
              disabled={isLoadingModels}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            >
              <option value="">
                {isLoadingModels ? 'Loading models...' : 'Select Model'}
              </option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Image Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📐 Image Size
          </label>
          <select
            value={selectedResolution}
            onChange={(e) => handleResolutionChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          >
            {RESOLUTION_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label} ({preset.width}×{preset.height})
              </option>
            ))}
          </select>
          
          {selectedResolution === 'custom' && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Width</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => updateData({ width: parseInt(e.target.value) || 512 })}
                  min="64"
                  max="2048"
                  step="64"
                  className="w-full px-2 py-1 text-sm rounded bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Height</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => updateData({ height: parseInt(e.target.value) || 512 })}
                  min="64"
                  max="2048"
                  step="64"
                  className="w-full px-2 py-1 text-sm rounded bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Generation Settings */}
        <div>
          <button
            onClick={() => setShowGenerationSettings(!showGenerationSettings)}
            className="flex items-center justify-between w-full p-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Generation Settings
            </span>
            <RefreshCw className={`w-4 h-4 transition-transform ${showGenerationSettings ? 'rotate-180' : ''}`} />
          </button>
          
          {showGenerationSettings && (
            <div className="mt-3 space-y-3 p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg">
              {/* Steps */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Steps: {steps}
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={steps}
                  onChange={(e) => updateData({ steps: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Guidance Scale */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Guidance Scale: {guidanceScale}
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={guidanceScale}
                  onChange={(e) => updateData({ guidanceScale: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Denoise */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Denoise: {denoise}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={denoise}
                  onChange={(e) => updateData({ denoise: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div>
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="flex items-center justify-between w-full p-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Advanced Settings
            </span>
            <RefreshCw className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
          </button>
          
          {showAdvancedSettings && (
            <div className="mt-3 space-y-3 p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg">
              {/* Sampler */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Sampler
                </label>
                <select
                  value={sampler}
                  onChange={(e) => updateData({ sampler: e.target.value })}
                  className="w-full px-2 py-1 text-sm rounded bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {SAMPLERS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Scheduler */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Scheduler
                </label>
                <select
                  value={scheduler}
                  onChange={(e) => updateData({ scheduler: e.target.value })}
                  className="w-full px-2 py-1 text-sm rounded bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {SCHEDULERS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Negative Prompt */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Negative Prompt
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => updateData({ negativePrompt: e.target.value })}
                  placeholder="What to avoid in the image..."
                  className="w-full px-2 py-1 text-sm rounded bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                  rows={2}
                />
              </div>

              {/* Seed */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Seed (-1 for random)
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => updateData({ seed: parseInt(e.target.value) || -1 })}
                  className="w-full px-2 py-1 text-sm rounded bg-gray-50/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Generation Progress */}
        {isGenerating && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm mb-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating image... {generationProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Generated Image Preview */}
        {lastGeneratedImage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated Image</span>
              <button
                onClick={handleDownloadImage}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
            <div className="relative">
              <img
                src={lastGeneratedImage}
                alt="Generated"
                className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                {width}×{height}
              </div>
            </div>
          </div>
        )}

        {/* Generated Image Display */}
        {lastGeneratedImage && (
          <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Generated Image:</h4>
            <div className="relative group">
              <img 
                src={`data:image/png;base64,${lastGeneratedImage}`}
                alt="Generated image"
                className="w-full h-auto rounded-lg shadow-md max-h-64 object-contain bg-white"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `data:image/png;base64,${lastGeneratedImage}`;
                    link.download = `generated-image-${Date.now()}.png`;
                    link.click();
                  }}
                  className="bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 px-3 py-1 rounded-md text-sm font-medium shadow-lg transition-all duration-200"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Output Labels */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="space-y-2">
            <div className="text-xs text-gray-600 dark:text-gray-400 text-right flex items-center justify-end gap-1">
              <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
              <span className="font-medium">Generated Image</span>
              <span className="text-gray-400 ml-1">(string)</span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 text-right flex items-center justify-end gap-1">
              <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
              <span className="font-medium">Generation Metadata</span>
              <span className="text-gray-400 ml-1">(object)</span>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        {isComfyUIConnected && selectedModel && prompt && (
          <button
            onClick={handleGenerateImage}
            disabled={isGenerating || !prompt.trim() || !selectedModel}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              !isGenerating && prompt.trim() && selectedModel
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                Generate Image
              </span>
            )}
          </button>
        )}
      </div>
    </BaseNode>
  );
});

ComfyUIImageGenNode.displayName = 'ComfyUIImageGenNode';

export default ComfyUIImageGenNode;
